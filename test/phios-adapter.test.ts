import assert from "node:assert/strict";
import test from "node:test";

import {
  buildPhiOSEvidenceRef,
  digestRenderReceipt,
  toPhiOSEvidenceEnvelope,
  verifyPhiOSEvidenceEnvelope,
  type VerifiedRenderReceipt,
  type VerifiedRenderReceiptPayload
} from "../src/index.js";

function receiptFixture(): VerifiedRenderReceipt {
  const payload: VerifiedRenderReceiptPayload = {
    schemaVersion: "phivid.render-receipt.v0.2",
    planId: "render-42",
    planDigest: "1".repeat(64),
    commandDigest: "2".repeat(64),
    ffmpegVersion: "ffmpeg version fixture",
    ffprobeVersion: "ffprobe version fixture",
    encoder: {
      codec: "h264",
      encoder: "libx264",
      acceleration: "cpu"
    },
    sourceArtifacts: [
      {
        assetId: "clip-a",
        path: "/tmp/clip-a.mp4",
        sha256: "3".repeat(64),
        sizeBytes: 1234
      }
    ],
    outputArtifact: {
      path: "/tmp/output.mp4",
      sha256: "4".repeat(64),
      sizeBytes: 4321
    },
    probe: {
      streams: [
        {
          codec_type: "video",
          codec_name: "h264",
          width: 128,
          height: 72,
          r_frame_rate: "10/1"
        }
      ],
      format: {
        duration: "1.000000",
        format_name: "mov,mp4,m4a,3gp,3g2,mj2"
      }
    },
    elapsedMs: 25,
    warnings: ["render_used_cpu_encoder"]
  };

  return {
    ...payload,
    receiptDigest: digestRenderReceipt(payload)
  };
}

test("PhiOS EvidenceRef matches canonical zero-authority shape", () => {
  const ref = buildPhiOSEvidenceRef({
    sourceId: "fixture",
    sourceKind: "phivid.video.render",
    sourceVersion: "phivid.render-receipt.v0.2",
    contentSha256: "a".repeat(64),
    observedAt: "2026-10-04T21:00:00Z",
    lineage: ["c".repeat(64), "b".repeat(64), "b".repeat(64)]
  });

  assert.equal(ref.schema_version, "phios.evidence_ref.v0.1");
  assert.equal(ref.evidence_ref, `evidence:sha256:${"a".repeat(64)}`);
  assert.deepEqual(ref.transformation_lineage_sha256s, [
    "b".repeat(64),
    "c".repeat(64)
  ]);
  assert.equal(ref.operational_authority, false);
  assert.equal(ref.action_authority, false);
  assert.equal(ref.execution_authority, false);
  assert.match(ref.evidence_ref_sha256, /^[a-f0-9]{64}$/);
});

test("verified PHIVid receipt becomes a self-hashed PhiOS evidence envelope", () => {
  const envelope = toPhiOSEvidenceEnvelope(receiptFixture(), {
    observedAt: "2026-10-04T21:00:00Z"
  });

  assert.equal(envelope.schema_version, "phivid.phios_evidence_envelope.v0.1");
  assert.equal(envelope.event_type, "phivid.render.verified");
  assert.equal(envelope.produced_by, "PHIVid");
  assert.equal(envelope.evidence_refs.length, 2);
  assert.equal(envelope.operational_authority, false);
  assert.equal(envelope.action_authority, false);
  assert.equal(envelope.execution_authority, false);
  assert.match(envelope.envelope_sha256, /^[a-f0-9]{64}$/);
  assert.equal(verifyPhiOSEvidenceEnvelope(envelope), true);

  const output = envelope.evidence_refs.find(
    (ref) => ref.evidence_ref === envelope.output_evidence_ref
  );
  assert.ok(output);
  assert.equal(output.content_sha256, "4".repeat(64));
  assert.deepEqual(output.transformation_lineage_sha256s, [
    "1".repeat(64),
    "2".repeat(64),
    "3".repeat(64),
    receiptFixture().receiptDigest
  ].sort());
});

test("tampered PHIVid receipt is rejected before envelope creation", () => {
  const receipt = receiptFixture();
  receipt.outputArtifact.sizeBytes = 9999;

  assert.throws(
    () =>
      toPhiOSEvidenceEnvelope(receipt, {
        observedAt: "2026-10-04T21:00:00Z"
      }),
    /receipt digest is invalid/
  );
});

test("envelope mutation fails verification", () => {
  const envelope = toPhiOSEvidenceEnvelope(receiptFixture(), {
    observedAt: "2026-10-04T21:00:00+00:00"
  });

  const tampered = {
    ...envelope,
    warnings: [...envelope.warnings, "invented"]
  };

  assert.equal(verifyPhiOSEvidenceEnvelope(tampered), false);
});

test("timestamp without timezone is rejected", () => {
  assert.throws(
    () =>
      toPhiOSEvidenceEnvelope(receiptFixture(), {
        observedAt: "2026-10-04T21:00:00"
      }),
    /timezone/
  );
});
