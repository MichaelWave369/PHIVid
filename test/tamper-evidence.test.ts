import assert from "node:assert/strict";
import { access, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  PHIVID_SCHEMA_VERSION,
  digestCanonical,
  executeFFmpeg,
  renderWithEvidence,
  sha256File,
  verifyRenderReceiptDigest,
  type VideoRenderPlan
} from "../src/index.js";

async function createFixture(directory: string): Promise<string> {
  const sourcePath = join(directory, "source.avi");

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

  return sourcePath;
}

function planFor(sourceHash?: string): VideoRenderPlan {
  return {
    schemaVersion: PHIVID_SCHEMA_VERSION,
    id: "tamper-evident-fixture",
    createdBy: "ci",
    sources: [
      {
        id: "source-a",
        uri: "asset://source-a",
        mediaType: "video/x-msvideo",
        ...(sourceHash ? { sha256: sourceHash } : {})
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
}

test("canonical digest is invariant to object key order", () => {
  assert.equal(
    digestCanonical({ b: 2, a: { d: 4, c: 3 } }),
    digestCanonical({ a: { c: 3, d: 4 }, b: 2 })
  );
});

test("declared source SHA-256 is verified before render", async () => {
  const directory = await mkdtemp(join(tmpdir(), "phivid-source-hash-"));

  try {
    const sourcePath = await createFixture(directory);
    const outputPath = join(directory, "output.mp4");
    const actual = await sha256File(sourcePath);

    const receipt = await renderWithEvidence({
      plan: planFor(actual.toUpperCase()),
      sourcePaths: { "source-a": sourcePath },
      outputPath,
      acceleration: "cpu",
      timeoutMs: 30_000
    });

    assert.equal(receipt.sourceArtifacts[0]?.sha256, actual);
    assert.equal(verifyRenderReceiptDigest(receipt), true);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("source hash mismatch aborts before output render", async () => {
  const directory = await mkdtemp(join(tmpdir(), "phivid-source-mismatch-"));

  try {
    const sourcePath = await createFixture(directory);
    const outputPath = join(directory, "should-not-exist.mp4");

    await assert.rejects(
      () =>
        renderWithEvidence({
          plan: planFor("0".repeat(64)),
          sourcePaths: { "source-a": sourcePath },
          outputPath,
          acceleration: "cpu",
          timeoutMs: 30_000
        }),
      /Source hash mismatch/
    );

    await assert.rejects(() => access(outputPath));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("command and receipt digests detect tampering", async () => {
  const directory = await mkdtemp(join(tmpdir(), "phivid-receipt-digest-"));

  try {
    const sourcePath = await createFixture(directory);
    const outputPath = join(directory, "output.mp4");

    const receipt = await renderWithEvidence({
      plan: planFor(),
      sourcePaths: { "source-a": sourcePath },
      outputPath,
      acceleration: "cpu",
      timeoutMs: 30_000
    });

    assert.match(receipt.commandDigest, /^[a-f0-9]{64}$/);
    assert.match(receipt.receiptDigest, /^[a-f0-9]{64}$/);
    assert.equal(verifyRenderReceiptDigest(receipt), true);

    const tampered = {
      ...receipt,
      warnings: [...receipt.warnings, "invented_warning"]
    };

    assert.equal(verifyRenderReceiptDigest(tampered), false);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
