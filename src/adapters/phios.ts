import { digestCanonical } from "../receipt.js";
import {
  verifyRenderReceiptDigest,
  type ArtifactEvidence,
  type VerifiedRenderReceipt
} from "../render/verified.js";

export interface PhiOSEvidenceRef {
  schema_version: "phios.evidence_ref.v0.1";
  evidence_ref: string;
  source_id: string;
  source_kind: string;
  source_version: string | null;
  content_sha256: string;
  created_at: string | null;
  observed_at: string;
  transformation_lineage_sha256s: readonly string[];
  admissibility_receipt_sha256: null;
  exactness_class: "byte_exact";
  operational_authority: false;
  action_authority: false;
  execution_authority: false;
  evidence_ref_sha256: string;
}

export interface PHIVidPhiOSEvidenceEnvelopePayload {
  schema_version: "phivid.phios_evidence_envelope.v0.1";
  event_type: "phivid.render.verified";
  produced_by: "PHIVid";
  source_receipt_sha256: string;
  plan_id: string;
  observed_at: string;
  output_evidence_ref: string;
  evidence_refs: readonly PhiOSEvidenceRef[];
  warnings: readonly string[];
  operational_authority: false;
  action_authority: false;
  execution_authority: false;
}

export interface PHIVidPhiOSEvidenceEnvelope
  extends PHIVidPhiOSEvidenceEnvelopePayload {
  envelope_sha256: string;
}

export interface PhiOSEvidenceEnvelopeOptions {
  observedAt: string;
}

function assertSha256(value: string, field: string): void {
  if (!/^[a-f0-9]{64}$/.test(value)) {
    throw new Error(`${field} must be a lowercase SHA-256 digest`);
  }
}

function assertObservedAt(value: string): void {
  if (
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(
      value
    )
  ) {
    throw new Error("observedAt must be an ISO-8601 timestamp with timezone");
  }

  if (Number.isNaN(Date.parse(value))) {
    throw new Error("observedAt must be a valid timestamp");
  }
}

function sortedUniqueSha256(values: readonly string[]): string[] {
  const unique = [...new Set(values)];
  for (const value of unique) {
    assertSha256(value, "transformation lineage digest");
  }
  return unique.sort();
}

function buildEvidenceRefBody(input: {
  sourceId: string;
  sourceKind: string;
  sourceVersion: string | null;
  contentSha256: string;
  observedAt: string;
  lineage: readonly string[];
}): Omit<PhiOSEvidenceRef, "evidence_ref_sha256"> {
  if (!input.sourceId || input.sourceId.length > 256) {
    throw new Error("source_id must be 1..256 characters");
  }
  if (!input.sourceKind || input.sourceKind.length > 64) {
    throw new Error("source_kind must be 1..64 characters");
  }
  assertSha256(input.contentSha256, "content_sha256");
  assertObservedAt(input.observedAt);

  return {
    schema_version: "phios.evidence_ref.v0.1",
    evidence_ref: `evidence:sha256:${input.contentSha256}`,
    source_id: input.sourceId,
    source_kind: input.sourceKind,
    source_version: input.sourceVersion,
    content_sha256: input.contentSha256,
    created_at: null,
    observed_at: input.observedAt,
    transformation_lineage_sha256s: sortedUniqueSha256(input.lineage),
    admissibility_receipt_sha256: null,
    exactness_class: "byte_exact",
    operational_authority: false,
    action_authority: false,
    execution_authority: false
  };
}

export function buildPhiOSEvidenceRef(input: {
  sourceId: string;
  sourceKind: string;
  sourceVersion?: string | null;
  contentSha256: string;
  observedAt: string;
  lineage?: readonly string[];
}): PhiOSEvidenceRef {
  const body = buildEvidenceRefBody({
    sourceId: input.sourceId,
    sourceKind: input.sourceKind,
    sourceVersion: input.sourceVersion ?? null,
    contentSha256: input.contentSha256,
    observedAt: input.observedAt,
    lineage: input.lineage ?? []
  });

  return {
    ...body,
    evidence_ref_sha256: digestCanonical(body)
  };
}

function sourceEvidenceRef(
  artifact: ArtifactEvidence,
  receipt: VerifiedRenderReceipt,
  observedAt: string,
  index: number
): PhiOSEvidenceRef {
  return buildPhiOSEvidenceRef({
    sourceId: artifact.assetId ?? `phivid:source:${index}`,
    sourceKind: "phivid.video.source",
    sourceVersion: receipt.schemaVersion,
    contentSha256: artifact.sha256,
    observedAt
  });
}

function outputEvidenceRef(
  receipt: VerifiedRenderReceipt,
  observedAt: string
): PhiOSEvidenceRef {
  const lineage = sortedUniqueSha256([
    receipt.planDigest,
    receipt.commandDigest,
    receipt.receiptDigest,
    ...receipt.sourceArtifacts.map((artifact) => artifact.sha256)
  ]);

  return buildPhiOSEvidenceRef({
    sourceId: `phivid:render:${receipt.planId}`,
    sourceKind: "phivid.video.render",
    sourceVersion: receipt.schemaVersion,
    contentSha256: receipt.outputArtifact.sha256,
    observedAt,
    lineage
  });
}

export function digestPhiOSEvidenceEnvelope(
  payload: PHIVidPhiOSEvidenceEnvelopePayload
): string {
  return digestCanonical(payload);
}

export function verifyPhiOSEvidenceEnvelope(
  envelope: PHIVidPhiOSEvidenceEnvelope
): boolean {
  const { envelope_sha256, ...payload } = envelope;
  return digestPhiOSEvidenceEnvelope(payload) === envelope_sha256;
}

export function toPhiOSEvidenceEnvelope(
  receipt: VerifiedRenderReceipt,
  options: PhiOSEvidenceEnvelopeOptions
): PHIVidPhiOSEvidenceEnvelope {
  if (!verifyRenderReceiptDigest(receipt)) {
    throw new Error("PHIVid render receipt digest is invalid");
  }
  assertObservedAt(options.observedAt);

  const sourceRefs = receipt.sourceArtifacts.map((artifact, index) =>
    sourceEvidenceRef(artifact, receipt, options.observedAt, index)
  );
  const outputRef = outputEvidenceRef(receipt, options.observedAt);
  const evidenceRefs = [...sourceRefs, outputRef].sort((a, b) =>
    a.evidence_ref.localeCompare(b.evidence_ref)
  );

  const payload: PHIVidPhiOSEvidenceEnvelopePayload = {
    schema_version: "phivid.phios_evidence_envelope.v0.1",
    event_type: "phivid.render.verified",
    produced_by: "PHIVid",
    source_receipt_sha256: receipt.receiptDigest,
    plan_id: receipt.planId,
    observed_at: options.observedAt,
    output_evidence_ref: outputRef.evidence_ref,
    evidence_refs: evidenceRefs,
    warnings: [...receipt.warnings],
    operational_authority: false,
    action_authority: false,
    execution_authority: false
  };

  return {
    ...payload,
    envelope_sha256: digestPhiOSEvidenceEnvelope(payload)
  };
}
