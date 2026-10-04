import { spawn } from "node:child_process";

export interface FFmpegCapabilities {
  available: boolean;
  ffmpegVersion?: string;
  ffprobeVersion?: string;
  encoders: readonly string[];
  error?: string;
}

function firstVersionLine(text: string): string | undefined {
  return text.split(/\r?\n/).map((line) => line.trim()).find(Boolean);
}

export function parseEncoderNames(text: string): string[] {
  const names = new Set<string>();

  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^\s*[A-Z.]{6}\s+([^\s]+)/);
    if (match?.[1] && match[1] !== "=") {
      names.add(match[1]);
    }
  }

  return [...names].sort();
}

function run(
  executable: string,
  args: readonly string[]
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(executable, args, { windowsHide: true });
    let stdout = "";
    let stderr = "";

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk: string) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("close", (code: number | null) => {
      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        reject(new Error(`${executable} exited with code ${code ?? "unknown"}`));
      }
    });
  });
}

export async function probeFFmpeg(
  ffmpegExecutable = "ffmpeg",
  ffprobeExecutable = "ffprobe"
): Promise<FFmpegCapabilities> {
  try {
    const [ffmpegVersionResult, ffprobeVersionResult, encodersResult] =
      await Promise.all([
        run(ffmpegExecutable, ["-version"]),
        run(ffprobeExecutable, ["-version"]),
        run(ffmpegExecutable, ["-hide_banner", "-encoders"])
      ]);

    const ffmpegVersion = firstVersionLine(
      ffmpegVersionResult.stdout || ffmpegVersionResult.stderr
    );
    const ffprobeVersion = firstVersionLine(
      ffprobeVersionResult.stdout || ffprobeVersionResult.stderr
    );

    return {
      available: true,
      ...(ffmpegVersion ? { ffmpegVersion } : {}),
      ...(ffprobeVersion ? { ffprobeVersion } : {}),
      encoders: parseEncoderNames(encodersResult.stdout || encodersResult.stderr)
    };
  } catch (error) {
    return {
      available: false,
      encoders: [],
      error: error instanceof Error ? error.message : String(error)
    };
  }
}
