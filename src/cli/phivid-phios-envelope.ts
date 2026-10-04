#!/usr/bin/env node
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, normalize, sep } from "node:path";
import { pathToFileURL } from "node:url";

import {
  toPhiOSEvidenceEnvelope,
  type VerifiedRenderReceipt
} from "../index.js";

function safeRelativeOutput(value: string): string {
  if (!value || isAbsolute(value)) {
    throw new Error("output path must be a non-empty relative path");
  }

  const normalized = normalize(value);
  if (
    normalized === ".." ||
    normalized.startsWith(`..${sep}`) ||
    normalized.split(sep).includes("..")
  ) {
    throw new Error("output path traversal is not allowed");
  }

  return normalized;
}

function parseArgs(args: readonly string[]): {
  receiptPath: string;
  outputPath: string;
  observedAt: string;
} {
  let receiptPath = "";
  let outputPath = "";
  let observedAt = "";

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--receipt") {
      receiptPath = args[++i] ?? "";
    } else if (arg === "--out") {
      outputPath = args[++i] ?? "";
    } else if (arg === "--observed-at") {
      observedAt = args[++i] ?? "";
    } else {
      throw new Error(`unknown argument: ${arg ?? ""}`);
    }
  }

  if (!receiptPath) throw new Error("--receipt is required");
  if (!outputPath) throw new Error("--out is required");
  if (!observedAt) throw new Error("--observed-at is required");

  return { receiptPath, outputPath, observedAt };
}

export async function writePhiOSEvidenceEnvelopeFile(input: {
  receiptPath: string;
  outputPath: string;
  observedAt: string;
  cwd?: string;
}): Promise<string> {
  const raw = await readFile(input.receiptPath, "utf8");
  const receipt = JSON.parse(raw) as VerifiedRenderReceipt;
  const envelope = toPhiOSEvidenceEnvelope(receipt, {
    observedAt: input.observedAt
  });

  const relativeOutput = safeRelativeOutput(input.outputPath);
  const destination = join(input.cwd ?? process.cwd(), relativeOutput);
  await mkdir(dirname(destination), { recursive: true });
  await writeFile(destination, JSON.stringify(envelope, null, 2) + "\n", "utf8");

  return envelope.envelope_sha256;
}

async function main(): Promise<void> {
  try {
    const args = parseArgs(process.argv.slice(2));
    const envelopeSha256 = await writePhiOSEvidenceEnvelopeFile(args);
    process.stdout.write(
      JSON.stringify({
        status: "written",
        envelopeSha256,
        output: args.outputPath.replaceAll("\\", "/")
      }) + "\n"
    );
  } catch (error) {
    process.stderr.write(
      `${error instanceof Error ? error.message : String(error)}\n`
    );
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
