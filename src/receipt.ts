import { createHash } from "node:crypto";
import type { VideoReceipt, VideoRenderPlan } from "./contracts.js";

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, nested]) => [key, canonicalize(nested)])
    );
  }

  return value;
}

export function canonicalJson(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

export function digestCanonical(value: unknown): string {
  return createHash("sha256").update(canonicalJson(value)).digest("hex");
}

export function digestPlan(plan: VideoRenderPlan): string {
  return digestCanonical(plan);
}

export function createReceipt(plan: VideoRenderPlan): VideoReceipt {
  return {
    schemaVersion: "phivid.receipt.v0.1",
    planId: plan.id,
    planDigest: digestPlan(plan),
    operationCount: plan.operations.length,
    sourceCount: plan.sources.length
  };
}
