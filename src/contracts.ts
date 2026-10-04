export const PHIVID_SCHEMA_VERSION = "phivid.plan.v0.1" as const;

export type VideoAssetId = string;
export type VideoPlanId = string;

export interface VideoSource {
  id: VideoAssetId;
  uri: string;
  sha256?: string;
  mediaType?: string;
}

export type VideoOperation =
  | {
      kind: "trim";
      assetId: VideoAssetId;
      startSeconds: number;
      endSeconds: number;
    }
  | {
      kind: "textOverlay";
      assetId: VideoAssetId;
      text: string;
      startSeconds: number;
      endSeconds: number;
    }
  | {
      kind: "fade";
      assetId: VideoAssetId;
      direction: "in" | "out";
      startSeconds: number;
      durationSeconds: number;
    }
  | {
      kind: "transcode";
      assetId: VideoAssetId;
      codec: "h264" | "hevc" | "av1";
    };

export interface VideoRenderPlan {
  schemaVersion: typeof PHIVID_SCHEMA_VERSION;
  id: VideoPlanId;
  createdBy: string;
  sources: readonly VideoSource[];
  operations: readonly VideoOperation[];
  output: {
    container: "mp4" | "mov" | "webm";
    codec: "h264" | "hevc" | "av1";
    width: number;
    height: number;
    fps: number;
    videoBitrateKbps?: number;
  };
}

export interface VideoReceipt {
  schemaVersion: "phivid.receipt.v0.1";
  planId: VideoPlanId;
  planDigest: string;
  operationCount: number;
  sourceCount: number;
}

export interface ValidationIssue {
  path: string;
  message: string;
}
