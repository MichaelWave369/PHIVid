export {
  PHIVID_SCHEMA_VERSION,
  type ValidationIssue,
  type VideoAssetId,
  type VideoOperation,
  type VideoPlanId,
  type VideoReceipt,
  type VideoRenderPlan,
  type VideoSource
} from "./contracts.js";

export { createReceipt, digestPlan } from "./receipt.js";
export { validatePlan } from "./validate.js";

export {
  buildFFmpegArgs,
  selectEncoder,
  type AccelerationPreference,
  type EncoderSelection,
  type FFmpegCommandInput,
  type VideoCodec
} from "./ffmpeg/command.js";

export {
  parseEncoderNames,
  probeFFmpeg,
  type FFmpegCapabilities
} from "./ffmpeg/capabilities.js";

export {
  executeFFmpeg,
  runProcess,
  type ProcessOptions,
  type ProcessResult
} from "./ffmpeg/process.js";

export {
  probeMedia,
  type MediaFormatProbe,
  type MediaProbe,
  type MediaStreamProbe
} from "./ffmpeg/probe.js";
