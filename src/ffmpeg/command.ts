import type { VideoRenderPlan } from "../contracts.js";

export type VideoCodec = VideoRenderPlan["output"]["codec"];
export type AccelerationPreference = "auto" | "gpu" | "cpu";

export interface EncoderSelection {
  codec: VideoCodec;
  encoder: string;
  acceleration: "gpu" | "cpu";
}

export interface FFmpegCommandInput {
  plan: VideoRenderPlan;
  sourcePaths: Readonly<Record<string, string>>;
  outputPath: string;
  availableEncoders: ReadonlySet<string>;
  acceleration?: AccelerationPreference;
}

const encoderPreference: Record<
  VideoCodec,
  { gpu: readonly string[]; cpu: readonly string[] }
> = {
  h264: {
    gpu: ["h264_nvenc"],
    cpu: ["libx264"]
  },
  hevc: {
    gpu: ["hevc_nvenc"],
    cpu: ["libx265"]
  },
  av1: {
    gpu: ["av1_nvenc"],
    cpu: ["libsvtav1", "libaom-av1"]
  }
};

function firstAvailable(
  candidates: readonly string[],
  available: ReadonlySet<string>
): string | undefined {
  return candidates.find((candidate) => available.has(candidate));
}

export function selectEncoder(
  codec: VideoCodec,
  available: ReadonlySet<string>,
  preference: AccelerationPreference = "auto"
): EncoderSelection {
  const candidates = encoderPreference[codec];

  if (preference !== "cpu") {
    const gpu = firstAvailable(candidates.gpu, available);
    if (gpu) {
      return { codec, encoder: gpu, acceleration: "gpu" };
    }

    if (preference === "gpu") {
      throw new Error(`No GPU encoder available for ${codec}`);
    }
  }

  const cpu = firstAvailable(candidates.cpu, available);
  if (cpu) {
    return { codec, encoder: cpu, acceleration: "cpu" };
  }

  throw new Error(`No qualified encoder available for ${codec}`);
}

function assertPositive(name: string, value: number): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${name} must be greater than zero`);
  }
}

function assertContainerCodec(plan: VideoRenderPlan): void {
  if (plan.output.container === "webm" && plan.output.codec !== "av1") {
    throw new Error("Current WebM qualification supports AV1 only");
  }
}

export function buildFFmpegArgs(
  input: FFmpegCommandInput
): { args: string[]; selection: EncoderSelection } {
  const { plan } = input;

  if (plan.sources.length !== 1) {
    throw new Error("Current FFmpeg qualification requires exactly one source");
  }

  assertPositive("width", plan.output.width);
  assertPositive("height", plan.output.height);
  assertPositive("fps", plan.output.fps);
  if (plan.output.videoBitrateKbps !== undefined) {
    assertPositive("videoBitrateKbps", plan.output.videoBitrateKbps);
  }
  assertContainerCodec(plan);

  const source = plan.sources[0];
  if (!source) {
    throw new Error("Render plan has no source");
  }

  const inputPath = input.sourcePaths[source.id];
  if (!inputPath) {
    throw new Error(`No bound file path for source asset ${source.id}`);
  }

  let trimStart: number | undefined;
  let trimDuration: number | undefined;

  for (const operation of plan.operations) {
    if (operation.assetId !== source.id) {
      throw new Error(
        `Operation references source ${operation.assetId}, but current qualification supports only ${source.id}`
      );
    }

    switch (operation.kind) {
      case "trim": {
        if (trimStart !== undefined) {
          throw new Error("Current FFmpeg qualification supports one trim operation");
        }
        trimStart = operation.startSeconds;
        trimDuration = operation.endSeconds - operation.startSeconds;
        assertPositive("trim duration", trimDuration);
        break;
      }

      case "transcode":
        if (operation.codec !== plan.output.codec) {
          throw new Error(
            `Transcode codec ${operation.codec} conflicts with output codec ${plan.output.codec}`
          );
        }
        break;

      case "textOverlay":
      case "fade":
        throw new Error(
          `Operation ${operation.kind} is declared but not yet qualified for FFmpeg execution`
        );
    }
  }

  const selection = selectEncoder(
    plan.output.codec,
    input.availableEncoders,
    input.acceleration ?? "auto"
  );

  const args = ["-hide_banner", "-nostdin", "-y"];

  if (trimStart !== undefined) {
    args.push("-ss", String(trimStart));
  }

  args.push("-i", inputPath);

  if (trimDuration !== undefined) {
    args.push("-t", String(trimDuration));
  }

  args.push("-vf", `scale=${plan.output.width}:${plan.output.height}`);
  args.push("-r", String(plan.output.fps));
  args.push("-c:v", selection.encoder);

  if (plan.output.videoBitrateKbps !== undefined) {
    args.push("-b:v", `${plan.output.videoBitrateKbps}k`);
  }

  if (plan.output.container === "webm") {
    args.push("-c:a", "libopus");
  } else {
    args.push("-c:a", "aac", "-movflags", "+faststart");
  }

  args.push(input.outputPath);

  return { args, selection };
}
