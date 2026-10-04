import assert from "node:assert/strict";
import { mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  PHIVID_SCHEMA_VERSION,
  buildFFmpegArgs,
  executeFFmpeg,
  probeFFmpeg,
  probeMedia,
  type VideoRenderPlan
} from "../src/index.js";

test("real FFmpeg render is verified by FFprobe", async () => {
  const capabilities = await probeFFmpeg();

  assert.equal(
    capabilities.available,
    true,
    capabilities.error ?? "FFmpeg should be available"
  );
  assert.ok(
    capabilities.encoders.includes("libx264"),
    "CI qualification requires the libx264 encoder"
  );

  const directory = await mkdtemp(join(tmpdir(), "phivid-render-"));

  try {
    const sourcePath = join(directory, "source.avi");
    const outputPath = join(directory, "render.mp4");

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
      id: "integration-render",
      createdBy: "ci",
      sources: [
        {
          id: "fixture",
          uri: "asset://fixture",
          mediaType: "video/x-msvideo"
        }
      ],
      operations: [
        {
          kind: "trim",
          assetId: "fixture",
          startSeconds: 0.5,
          endSeconds: 1.5
        },
        {
          kind: "transcode",
          assetId: "fixture",
          codec: "h264"
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

    const command = buildFFmpegArgs({
      plan,
      sourcePaths: {
        fixture: sourcePath
      },
      outputPath,
      availableEncoders: new Set(capabilities.encoders),
      acceleration: "cpu"
    });

    assert.equal(command.selection.encoder, "libx264");
    assert.equal(command.selection.acceleration, "cpu");

    await executeFFmpeg(command.args, "ffmpeg", { timeoutMs: 30_000 });

    const outputStat = await stat(outputPath);
    assert.ok(outputStat.size > 1_000, "rendered MP4 should not be empty");

    const probe = await probeMedia(outputPath);
    const video = probe.streams.find(
      (stream) => stream.codec_type === "video"
    );

    assert.ok(video, "rendered artifact should contain a video stream");
    assert.equal(video.codec_name, "h264");
    assert.equal(video.width, 128);
    assert.equal(video.height, 72);
    assert.equal(video.r_frame_rate, "10/1");

    const duration = Number(probe.format.duration);
    assert.ok(Number.isFinite(duration));
    assert.ok(
      duration >= 0.8 && duration <= 1.2,
      `expected approximately 1 second, got ${duration}`
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
