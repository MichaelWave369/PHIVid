import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  PHIVID_SCHEMA_VERSION,
  digestPlan,
  executeFFmpeg,
  renderWithEvidence,
  sha256File,
  type VideoRenderPlan
} from "../src/index.js";

test("sha256File matches direct buffer hashing", async () => {
  const directory = await mkdtemp(join(tmpdir(), "phivid-hash-"));
  try {
    const filePath = join(directory, "fixture.bin");
    await BunWriteNotUsed(filePath, Buffer.from("phi-video-evidence"));
    const bytes = await readFile(filePath);
    const expected = createHash("sha256").update(bytes).digest("hex");
    assert.equal(await sha256File(filePath), expected);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

async function BunWriteNotUsed(path: string, data: Buffer): Promise<void> {
  const { writeFile } = await import("node:fs/promises");
  await writeFile(path, data);
}

test("verified render receipt binds plan, source, output, encoder, and probe facts", async () => {
  const directory = await mkdtemp(join(tmpdir(), "phivid-receipt-"));

  try {
    const sourcePath = join(directory, "source.avi");
    const outputPath = join(directory, "output.mp4");

    await executeFFmpeg(
      [
        "-hide_banner",
        "-nostdin",
        "-y",
        "-f",
        "lavfi",
        "-i",
        "testsrc2=size=160x90:rate=10:duration=2",
        "-an",
        "-c:v",
        "mpeg4",
        "-q:v",
        "5",
        sourcePath
      ],
      "ffmpeg",
      { timeoutMs: 30_000 }
    );

    const plan: VideoRenderPlan = {
      schemaVersion: PHIVID_SCHEMA_VERSION,
      id: "receipt-fixture",
      createdBy: "ci",
      sources: [
        {
          id: "source-a",
          uri: "asset://source-a",
          mediaType: "video/x-msvideo"
        }
      ],
      operations: [
        {
          kind: "trim",
          assetId: "source-a",
          startSeconds: 0.5,
          endSeconds: 1.5
        }
      ],
      output: {
        container: "mp4",
        codec: "h264",
        width: 128,
        height: 72,
        fps: 10,
        videoBitrateKbps: 500
      }
    };

    const receipt = await renderWithEvidence({
      plan,
      sourcePaths: { "source-a": sourcePath },
      outputPath,
      acceleration: "cpu",
      timeoutMs: 30_000
    });

    assert.equal(receipt.schemaVersion, "phivid.render-receipt.v0.2");
    assert.equal(receipt.planId, plan.id);
    assert.equal(receipt.planDigest, digestPlan(plan));
    assert.equal(receipt.encoder.encoder, "libx264");
    assert.equal(receipt.encoder.acceleration, "cpu");
    assert.match(receipt.ffmpegVersion, /^ffmpeg version/i);
    assert.match(receipt.ffprobeVersion, /^ffprobe version/i);
    assert.equal(receipt.sourceArtifacts.length, 1);
    assert.equal(receipt.sourceArtifacts[0]?.assetId, "source-a");
    assert.match(receipt.sourceArtifacts[0]?.sha256 ?? "", /^[a-f0-9]{64}$/);
    assert.match(receipt.outputArtifact.sha256, /^[a-f0-9]{64}$/);
    assert.match(receipt.commandDigest, /^[a-f0-9]{64}$/);
    assert.match(receipt.receiptDigest, /^[a-f0-9]{64}$/);
    assert.ok(receipt.outputArtifact.sizeBytes > 1_000);
    assert.ok(receipt.elapsedMs > 0);
    assert.deepEqual(receipt.warnings, ["render_used_cpu_encoder"]);

    const video = receipt.probe.streams.find(
      (stream) => stream.codec_type === "video"
    );
    assert.equal(video?.codec_name, "h264");
    assert.equal(video?.width, 128);
    assert.equal(video?.height, 72);
    assert.equal(video?.r_frame_rate, "10/1");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
