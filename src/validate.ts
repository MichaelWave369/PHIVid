import type {
  ValidationIssue,
  VideoOperation,
  VideoRenderPlan
} from "./contracts.js";

function validateOperation(
  operation: VideoOperation,
  sourceIds: ReadonlySet<string>,
  index: number
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const path = `operations[${index}]`;

  if (!sourceIds.has(operation.assetId)) {
    issues.push({
      path: `${path}.assetId`,
      message: `Unknown asset: ${operation.assetId}`
    });
  }

  if (operation.kind === "trim" && operation.endSeconds <= operation.startSeconds) {
    issues.push({
      path,
      message: "Trim endSeconds must be greater than startSeconds"
    });
  }

  if (operation.kind === "textOverlay" && operation.endSeconds <= operation.startSeconds) {
    issues.push({
      path,
      message: "Text overlay endSeconds must be greater than startSeconds"
    });
  }

  if (operation.kind === "fade" && operation.durationSeconds <= 0) {
    issues.push({
      path: `${path}.durationSeconds`,
      message: "Fade durationSeconds must be greater than zero"
    });
  }

  return issues;
}

export function validatePlan(plan: VideoRenderPlan): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (plan.sources.length === 0) {
    issues.push({ path: "sources", message: "At least one source is required" });
  }

  const sourceIds = new Set(plan.sources.map((source) => source.id));
  if (sourceIds.size !== plan.sources.length) {
    issues.push({ path: "sources", message: "Source ids must be unique" });
  }

  if (plan.output.width <= 0 || plan.output.height <= 0) {
    issues.push({ path: "output", message: "Output dimensions must be positive" });
  }

  if (plan.output.fps <= 0) {
    issues.push({ path: "output.fps", message: "FPS must be greater than zero" });
  }

  if (
    plan.output.videoBitrateKbps !== undefined &&
    plan.output.videoBitrateKbps <= 0
  ) {
    issues.push({
      path: "output.videoBitrateKbps",
      message: "Bitrate must be greater than zero"
    });
  }

  plan.operations.forEach((operation, index) => {
    issues.push(...validateOperation(operation, sourceIds, index));
  });

  return issues;
}
