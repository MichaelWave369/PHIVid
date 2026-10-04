import assert from "node:assert/strict";
import test from "node:test";

import {
  PHIVID_SCHEMA_VERSION,
  createReceipt,
  digestPlan,
  validatePlan,
  type VideoRenderPlan
} from "../src/index.js";

const validPlan: VideoRenderPlan = {
  schemaVersion: PHIVID_SCHEMA_VERSION,
  id: "render-demo",
  createdBy: "test",
  sources: [
    {
      id: "clip-a",
      uri: "file:///demo.mp4",
      sha256: "abc123",
      mediaType: "video/mp4"
    }
  ],
  operations: [
    {
      kind: "trim",
      assetId: "clip-a",
      startSeconds: 1,
      endSeconds: 4
    }
  ],
  output: {
    container: "mp4",
    codec: "h264",
    width: 1920,
    height: 1080,
    fps: 30,
    videoBitrateKbps: 8000
  }
};

test("valid plan passes validation", () => {
  assert.deepEqual(validatePlan(validPlan), []);
});

test("unknown asset is rejected", () => {
  const plan: VideoRenderPlan = {
    ...validPlan,
    operations: [
      {
        kind: "trim",
        assetId: "not-real",
        startSeconds: 0,
        endSeconds: 1
      }
    ]
  };

  assert.equal(validatePlan(plan)[0]?.path, "operations[0].assetId");
});

test("invalid trim range is rejected", () => {
  const plan: VideoRenderPlan = {
    ...validPlan,
    operations: [
      {
        kind: "trim",
        assetId: "clip-a",
        startSeconds: 4,
        endSeconds: 1
      }
    ]
  };

  assert.match(validatePlan(plan)[0]?.message ?? "", /greater than/);
});

test("equivalent plans produce stable receipts", () => {
  assert.equal(digestPlan(validPlan), digestPlan(structuredClone(validPlan)));
  assert.match(createReceipt(validPlan).planDigest, /^[a-f0-9]{64}$/);
});
