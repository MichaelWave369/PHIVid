import { spawn } from "node:child_process";

export interface ProcessResult {
  executable: string;
  args: readonly string[];
  exitCode: number;
  stdout: string;
  stderr: string;
}

export interface ProcessOptions {
  timeoutMs?: number;
}

export function runProcess(
  executable: string,
  args: readonly string[],
  options: ProcessOptions = {}
): Promise<ProcessResult> {
  const timeoutMs = options.timeoutMs ?? 60_000;

  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new RangeError("timeoutMs must be greater than zero");
  }

  return new Promise((resolve, reject) => {
    const child = spawn(executable, [...args], {
      windowsHide: true,
      shell: false
    });

    let stdout = "";
    let stderr = "";
    let timedOut = false;

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");

    child.stdout.on("data", (chunk: string) => {
      stdout += chunk;
    });

    child.stderr.on("data", (chunk: string) => {
      stderr += chunk;
    });

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
    }, timeoutMs);

    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });

    child.on("close", (code: number | null) => {
      clearTimeout(timer);

      if (timedOut) {
        reject(
          new Error(
            `${executable} exceeded timeout of ${timeoutMs}ms`
          )
        );
        return;
      }

      const exitCode = code ?? -1;
      const result: ProcessResult = {
        executable,
        args: [...args],
        exitCode,
        stdout,
        stderr
      };

      if (exitCode !== 0) {
        const tail = stderr.trim().split(/\r?\n/).slice(-8).join("\n");
        reject(
          new Error(
            `${executable} exited with code ${exitCode}${tail ? `\n${tail}` : ""}`
          )
        );
        return;
      }

      resolve(result);
    });
  });
}

export function executeFFmpeg(
  args: readonly string[],
  ffmpegExecutable = "ffmpeg",
  options: ProcessOptions = {}
): Promise<ProcessResult> {
  return runProcess(ffmpegExecutable, args, options);
}
