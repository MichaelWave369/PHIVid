# FFmpeg Capability Qualification

This rung establishes a governed FFmpeg boundary without yet executing production renders.

## Qualified scope

- discover `ffmpeg` and `ffprobe` version lines
- parse advertised encoder names
- choose H.264, HEVC, or AV1 encoders from explicit capability evidence
- prefer NVIDIA NVENC in `auto` mode when the matching encoder is actually present
- fall back to qualified CPU encoders when allowed
- refuse silent CPU fallback when `gpu` is explicitly required
- bind one render-plan source asset to one explicit file path
- build FFmpeg arguments as an argv array rather than a shell command
- execute one qualified trim operation
- reject operations that are declared but not yet implemented

## Why this exists

The legacy PHIVid prototype directly selected the first video file found in an upload directory and documented GPU acceleration while using `libx264`. The modern runtime replaces both behaviors:

1. source assets must be explicitly bound,
2. hardware acceleration is selected only from discovered encoders.

The legacy pipeline could also obtain provider output without applying it during the FFmpeg render. Modern PHIVid therefore treats unsupported operations as errors rather than silently ignoring them.

## Encoder policy

Current preference order:

| Codec | GPU | CPU |
| --- | --- | --- |
| H.264 | `h264_nvenc` | `libx264` |
| HEVC | `hevc_nvenc` | `libx265` |
| AV1 | `av1_nvenc` | `libsvtav1`, then `libaom-av1` |

This is selection policy, not a claim that any given machine has those encoders. `probeFFmpeg()` supplies the evidence.

## Not yet qualified

- actual subprocess rendering
- multi-source concat/compositing
- text overlays
- fades/transitions
- caption burn-in
- audio normalization
- thumbnails and proxies
- provider/model output consumption
- encoder-specific quality controls
- hardware decode
- editor XML/project export

Those land in later rungs with fixtures.
