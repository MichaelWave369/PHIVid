# Verified FFmpeg Render Qualification

This rung crosses PHIVid from command planning into real artifact execution.

## CI acceptance path

The integration test:

1. probes the installed FFmpeg/FFprobe tools,
2. requires a qualified CPU H.264 encoder (`libx264`),
3. creates a synthetic 160×90, 10 fps, two-second video with FFmpeg's `testsrc2` filter,
4. binds that fixture to an explicit PHIVid asset id,
5. builds render arguments through `buildFFmpegArgs()`,
6. executes the render through PHIVid's subprocess boundary,
7. probes the resulting MP4 with FFprobe,
8. verifies:
   - non-empty artifact,
   - H.264 video codec,
   - 128×72 output dimensions,
   - 10 fps,
   - approximately one second of output duration.

No external media fixture is downloaded or committed.

## Process boundary

PHIVid launches executables with:

- `shell: false`,
- argument arrays rather than shell command strings,
- bounded execution time,
- captured stdout/stderr,
- non-zero exit rejection.

This does not make arbitrary executable invocation safe for untrusted callers. The exported subprocess helper is runtime plumbing; host authority still determines which executable and plan may run.

## Evidence boundary

This rung verifies output facts with FFprobe, but it does not yet create a persistent render receipt containing:

- executable version,
- selected encoder,
- source hash,
- output hash,
- probe facts,
- wall-clock duration,
- warnings.

That evidence-bearing receipt is a later rung.

## Not yet qualified

- NVENC execution on CI hardware
- HEVC or AV1 artifact execution
- overlays/fades/captions
- multiple inputs
- audio mixing
- proxy/thumbnail output
- provider/model output consumption
- cancellation/progress streaming
- sandboxing
