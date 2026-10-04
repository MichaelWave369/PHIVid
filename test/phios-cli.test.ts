import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

import {
  digestRenderReceipt,
  verifyPhiOSEvidenceEnvelope,
  type PHIVidPhiOSEvidenceEnvelope,
  type VerifiedRenderReceipt,
  type VerifiedRenderReceiptPayload
} from "../src/index.js";

function receiptFixture(): VerifiedRenderReceipt {
  const payload: VerifiedRenderReceiptPayload = {
    schemaVersion: "phivid.render-receipt.v0.2",
    planId: "cli-render-42",
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
        path: "fixtures/clip-a.mp4",
        sha256: "3".repeat(64),
        sizeBytes: 1234
      }
    ],
    outputArtifact: {
      path: "render/output.mp4",
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

test("phivid-phios-envelope writes deterministic zero-authority evidence", async () => {
  const directory = await mkdtemp(join(tmpdir(), "phivid-envelope-cli-"));

  try {
    const receiptPath = join(directory, "receipt.json");
    await writeFile(
      receiptPath,
      JSON.stringify(receiptFixture(), null, 2),
      "utf8"
    );

    const cli = join(process.cwd(), "dist/src/cli/phivid-phios-envelope.js");
    const args = [
      cli,
      "--receipt",
      receiptPath,
      "--out",
      "evidence/phivid-envelope.json",
      "--observed-at",
      "2026-10-04T22:56:00Z"
    ];

    const first = spawnSync(process.execPath, args, {
      cwd: directory,
      encoding: "utf8"
    });
    assert.equal(first.status, 0, first.stderr);

    const firstBytes = await readFile(
      join(directory, "evidence/phivid-envelope.json")
    );
    const firstEnvelope = JSON.parse(
      firstBytes.toString("utf8")
    ) as PHIVidPhiOSEvidenceEnvelope;

    assert.equal(verifyPhiOSEvidenceEnvelope(firstEnvelope), true);
    assert.equal(firstEnvelope.operational_authority, false);
    assert.equal(firstEnvelope.action_authority, false);
    assert.equal(firstEnvelope.execution_authority, false);
    assert.equal(
      firstEnvelope.output_evidence_ref,
      `evidence:sha256:${"4".repeat(64)}`
    );

    const second = spawnSync(process.execPath, args, {
      cwd: directory,
      encoding: "utf8"
    });
    assert.equal(second.status, 0, second.stderr);

    const secondBytes = await readFile(
      join(directory, "evidence/phivid-envelope.json")
    );
    assert.deepEqual(firstBytes, secondBytes);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("CLI rejects a tampered render receipt", async () => {
  const directory = await mkdtemp(join(tmpdir(), "phivid-envelope-bad-"));

  try {
    const receipt = receiptFixture();
    receipt.outputArtifact.sizeBytes = 9999;

    const receiptPath = join(directory, "receipt.json");
    await writeFile(receiptPath, JSON.stringify(receipt), "utf8");

    const cli = join(process.cwd(), "dist/src/cli/phivid-phios-envelope.js");
    const result = spawnSync(
      process.execPath,
      [
        cli,
        "--receipt",
        receiptPath,
        "--out",
        "evidence/envelope.json",
        "--observed-at",
        "2026-10-04T22:56:00Z"
      ],
      { cwd: directory, encoding: "utf8" }
    );

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /receipt digest is invalid/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("CLI requires explicit observation time", async () => {
  const directory = await mkdtemp(join(tmpdir(), "phivid-envelope-time-"));

  try {
    const receiptPath = join(directory, "receipt.json");
    await writeFile(receiptPath, JSON.stringify(receiptFixture()), "utf8");

    const cli = join(process.cwd(), "dist/src/cli/phivid-phios-envelope.js");
    const result = spawnSync(
      process.execPath,
      [
        cli,
        "--receipt",
        receiptPath,
        "--out",
        "evidence/envelope.json"
      ],
      { cwd: directory, encoding: "utf8" }
    );

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /--observed-at is required/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("CLI rejects output path traversal", async () => {
  const directory = await mkdtemp(join(tmpdir(), "phivid-envelope-path-"));

  try {
    const receiptPath = join(directory, "receipt.json");
    await writeFile(receiptPath, JSON.stringify(receiptFixture()), "utf8");

    const cli = join(process.cwd(), "dist/src/cli/phivid-phios-envelope.js");
    const result = spawnSync(
      process.execPath,
      [
        cli,
        "--receipt",
        receiptPath,
        "--out",
        "../escape.json",
        "--observed-at",
        "2026-10-04T22:56:00Z"
      ],
      { cwd: directory, encoding: "utf8" }
    );

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /traversal/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
