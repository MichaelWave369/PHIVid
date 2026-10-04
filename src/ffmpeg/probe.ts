import { runProcess } from "./process.js";

export interface MediaStreamProbe {
  index?: number;
  codec_name?: string;
  codec_type?: string;
  width?: number;
  height?: number;
  r_frame_rate?: string;
}

export interface MediaFormatProbe {
  duration?: string;
  format_name?: string;
}

export interface MediaProbe {
  streams: MediaStreamProbe[];
  format: MediaFormatProbe;
}

export async function probeMedia(
  filePath: string,
  ffprobeExecutable = "ffprobe"
): Promise<MediaProbe> {
  const result = await runProcess(
    ffprobeExecutable,
    [
      "-v",
      "error",
      "-show_entries",
      "stream=index,codec_type,codec_name,width,height,r_frame_rate",
      "-show_entries",
      "format=duration,format_name",
      "-of",
      "json",
      filePath
    ],
    { timeoutMs: 30_000 }
  );

  let parsed: unknown;
  try {
    parsed = JSON.parse(result.stdout);
  } catch {
    throw new Error("ffprobe returned invalid JSON");
  }

  if (!parsed || typeof parsed !== "object") {
    throw new Error("ffprobe returned an invalid payload");
  }

  const object = parsed as {
    streams?: unknown;
    format?: unknown;
  };

  if (!Array.isArray(object.streams)) {
    throw new Error("ffprobe payload is missing streams");
  }

  const format =
    object.format && typeof object.format === "object"
      ? (object.format as MediaFormatProbe)
      : {};

  return {
    streams: object.streams as MediaStreamProbe[],
    format
  };
}
