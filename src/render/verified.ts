import { stat } from "node:fs/promises";

import type { VideoRenderPlan } from "../contracts.js";
import { digestCanonical, digestPlan } from "../receipt.js";
import {
  buildFFmpegArgs,
  type AccelerationPreference,
  type EncoderSelection
} from "../ffmpeg/command.js";
import { probeFFmpeg } from "../ffmpeg/capabilities.js";
import { executeFFmpeg } from "../ffmpeg/process.js";
import { probeMedia, type MediaProbe } from "../ffmpeg/probe.js";
import { sha256File } from "../evidence/hash.js";

export interface ArtifactEvidence {
  assetId?: string;
  path: string;
  sha256: string;
  sizeBytes: number;
}

export interface VerifiedRenderReceiptPayload {
  schemaVersion: "phivid.render-receipt.v0.2";
  planId: string;
  planDigest: string;
  commandDigest: string;
  ffmpegVersion: string;
  ffprobeVersion: string;
  encoder: EncoderSelection;
  sourceArtifacts: readonly ArtifactEvidence[];
  outputArtifact: ArtifactEvidence;
  probe: MediaProbe;
  elapsedMs: number;
  warnings: readonly string[];
}

export interface VerifiedRenderReceipt extends VerifiedRenderReceiptPayload {
  receiptDigest: string;
}

export interface VerifiedRenderInput {
  plan: VideoRenderPlan;
  sourcePaths: Readonly<Record<string, string>>;
  outputPath: string;
  acceleration?: AccelerationPreference;
  ffmpegExecutable?: string;
  ffprobeExecutable?: string;
  timeoutMs?: number;
}

async function artifactEvidence(
  path: string,
  assetId?: string
): Promise<ArtifactEvidence> {
  const info = await stat(path);
  if (!info.isFile()) {
    throw new Error(`Artifact is not a regular file: ${path}`);
  }

  return {
    ...(assetId ? { assetId } : {}),
    path,
    sha256: await sha256File(path),
    sizeBytes: info.size
  };
}

function assertExpectedSourceHash(
  assetId: string,
  expected: string | undefined,
  actual: string
): void {
  if (!expected) {
    return;
  }

  const normalizedExpected = expected.toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(normalizedExpected)) {
    throw new Error(`Invalid expected SHA-256 for source asset ${assetId}`);
  }

  if (normalizedExpected !== actual) {
    throw new Error(
      `Source hash mismatch for ${assetId}: expected ${normalizedExpected}, got ${actual}`
    );
  }
}

export function digestRenderReceipt(
  payload: VerifiedRenderReceiptPayload
): string {
  return digestCanonical(payload);
}

export function verifyRenderReceiptDigest(
  receipt: VerifiedRenderReceipt
): boolean {
  const { receiptDigest, ...payload } = receipt;
  return digestRenderReceipt(payload) === receiptDigest;
}

export async function renderWithEvidence(
  input: VerifiedRenderInput
): Promise<VerifiedRenderReceipt> {
  const ffmpegExecutable = input.ffmpegExecutable ?? "ffmpeg";
  const ffprobeExecutable = input.ffprobeExecutable ?? "ffprobe";
  const capabilities = await probeFFmpeg(ffmpegExecutable, ffprobeExecutable);

  if (!capabilities.available) {
    throw new Error(
      `FFmpeg capability probe failed: ${capabilities.error ?? "unknown error"}`
    );
  }

  if (!capabilities.ffmpegVersion || !capabilities.ffprobeVersion) {
    throw new Error("FFmpeg capability probe did not return version evidence");
  }

  const sourceArtifacts = await Promise.all(
    input.plan.sources.map(async (source) => {
      const path = input.sourcePaths[source.id];
      if (!path) {
        throw new Error(`No bound file path for source asset ${source.id}`);
      }

      const evidence = await artifactEvidence(path, source.id);
      assertExpectedSourceHash(source.id, source.sha256, evidence.sha256);
      return evidence;
    })
  );

  const command = buildFFmpegArgs({
    plan: input.plan,
    sourcePaths: input.sourcePaths,
    outputPath: input.outputPath,
    availableEncoders: new Set(capabilities.encoders),
    acceleration: input.acceleration ?? "auto"
  });

  const commandDigest = digestCanonical({
    executable: ffmpegExecutable,
    args: command.args
  });

  const startedAt = process.hrtime.bigint();
  await executeFFmpeg(command.args, ffmpegExecutable, {
    timeoutMs: input.timeoutMs ?? 60_000
  });
  const elapsedMs =
    Number(process.hrtime.bigint() - startedAt) / 1_000_000;

  const [outputArtifact, probe] = await Promise.all([
    artifactEvidence(input.outputPath),
    probeMedia(input.outputPath, ffprobeExecutable)
  ]);

  const warnings: string[] = [];
  if (command.selection.acceleration === "cpu") {
    warnings.push("render_used_cpu_encoder");
  }

  const payload: VerifiedRenderReceiptPayload = {
    schemaVersion: "phivid.render-receipt.v0.2",
    planId: input.plan.id,
    planDigest: digestPlan(input.plan),
    commandDigest,
    ffmpegVersion: capabilities.ffmpegVersion,
    ffprobeVersion: capabilities.ffprobeVersion,
    encoder: command.selection,
    sourceArtifacts,
    outputArtifact,
    probe,
    elapsedMs,
    warnings
  };

  return {
    ...payload,
    receiptDigest: digestRenderReceipt(payload)
  };
}
