import { stat } from "node:fs/promises";

import type { VideoRenderPlan } from "../contracts.js";
import { digestPlan } from "../receipt.js";
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

export interface VerifiedRenderReceipt {
  schemaVersion: "phivid.render-receipt.v0.1";
  planId: string;
  planDigest: string;
  ffmpegVersion: string;
  ffprobeVersion: string;
  encoder: EncoderSelection;
  sourceArtifacts: readonly ArtifactEvidence[];
  outputArtifact: ArtifactEvidence;
  probe: MediaProbe;
  elapsedMs: number;
  warnings: readonly string[];
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
      return artifactEvidence(path, source.id);
    })
  );

  const command = buildFFmpegArgs({
    plan: input.plan,
    sourcePaths: input.sourcePaths,
    outputPath: input.outputPath,
    availableEncoders: new Set(capabilities.encoders),
    acceleration: input.acceleration ?? "auto"
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

  return {
    schemaVersion: "phivid.render-receipt.v0.1",
    planId: input.plan.id,
    planDigest: digestPlan(input.plan),
    ffmpegVersion: capabilities.ffmpegVersion,
    ffprobeVersion: capabilities.ffprobeVersion,
    encoder: command.selection,
    sourceArtifacts,
    outputArtifact,
    probe,
    elapsedMs,
    warnings
  };
}
