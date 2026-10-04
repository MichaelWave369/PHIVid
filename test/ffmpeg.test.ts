import assert from "node:assert/strict";
import test from "node:test";

import {
  PHIVID_SCHEMA_VERSION,
  buildFFmpegArgs,
  parseEncoderNames,
  selectEncoder,
  type VideoRenderPlan
} from "../src/index.js";

const encoderFixture = `Encoders:
 V..... = Video
 A..... = Audio
 ------
 V....D libx264              H.264 / AVC
 V....D h264_nvenc           NVIDIA NVENC H.264 encoder
 V....D hevc_nvenc           NVIDIA NVENC HEVC encoder
 V..... libsvtav1            SVT-AV1 encoder
 A..... aac                  AAC encoder
`;

const basePlan: VideoRenderPlan = {
  schemaVersion: PHIVID_SCHEMA_VERSION,
  id: "render-ffmpeg-fixture",
  createdBy: "test",
  sources: [
    {
      id: "clip-a",
      uri: "asset://clip-a",
      mediaType: "video/mp4"
    }
  ],
  operations: [],
  output: {
    container: "mp4",
    codec: "h264",
    width: 1920,
    height: 1080,
    fps: 30,
    videoBitrateKbps: 8000
  }
};

test("encoder parser extracts stable encoder names", () => {
  assert.deepEqual(parseEncoderNames(encoderFixture), [
    "aac",
    "h264_nvenc",
    "hevc_nvenc",
    "libsvtav1",
    "libx264"
  ]);
});

test("auto mode prefers NVENC when present", () => {
  assert.deepEqual(
    selectEncoder("h264", new Set(["libx264", "h264_nvenc"])),
    {
      codec: "h264",
      encoder: "h264_nvenc",
      acceleration: "gpu"
    }
  );
});

test("auto mode falls back to CPU", () => {
  const selected = selectEncoder("h264", new Set(["libx264"]));
  assert.equal(selected.encoder, "libx264");
  assert.equal(selected.acceleration, "cpu");
});

test("explicit GPU mode refuses silent CPU fallback", () => {
  assert.throws(
    () => selectEncoder("h264", new Set(["libx264"]), "gpu"),
    /No GPU encoder/
  );
});

test("command builder binds the declared asset path", () => {
  const plan: VideoRenderPlan = {
    ...basePlan,
    operations: [
      {
        kind: "trim",
        assetId: "clip-a",
        startSeconds: 2.5,
        endSeconds: 10.5
      }
    ]
  };

  const result = buildFFmpegArgs({
    plan,
    sourcePaths: {
      "clip-a": "/media/input clip.mp4"
    },
    outputPath: "/renders/out.mp4",
    availableEncoders: new Set(["libx264"])
  });

  assert.equal(result.selection.encoder, "libx264");
  assert.deepEqual(result.args.slice(0, 10), [
    "-hide_banner",
    "-nostdin",
    "-y",
    "-ss",
    "2.5",
    "-i",
    "/media/input clip.mp4",
    "-t",
    "8",
    "-vf"
  ]);
  assert.equal(result.args.at(-1), "/renders/out.mp4");
});

test("command builder never guesses an input file", () => {
  assert.throws(
    () =>
      buildFFmpegArgs({
        plan: basePlan,
        sourcePaths: {},
        outputPath: "/renders/out.mp4",
        availableEncoders: new Set(["libx264"])
      }),
    /No bound file path/
  );
});

test("unqualified operations fail instead of being ignored", () => {
  const plan: VideoRenderPlan = {
    ...basePlan,
    operations: [
      {
        kind: "fade",
        assetId: "clip-a",
        direction: "in",
        startSeconds: 0,
        durationSeconds: 1
      }
    ]
  };

  assert.throws(
    () =>
      buildFFmpegArgs({
        plan,
        sourcePaths: {
          "clip-a": "/media/input.mp4"
        },
        outputPath: "/renders/out.mp4",
        availableEncoders: new Set(["libx264"])
      }),
    /not yet qualified/
  );
});

test("WebM refuses a codec outside current qualification", () => {
  const plan: VideoRenderPlan = {
    ...basePlan,
    output: {
      ...basePlan.output,
      container: "webm",
      codec: "h264"
    }
  };

  assert.throws(
    () =>
      buildFFmpegArgs({
        plan,
        sourcePaths: {
          "clip-a": "/media/input.mp4"
        },
        outputPath: "/renders/out.webm",
        availableEncoders: new Set(["libx264"])
      }),
    /WebM/
  );
});
