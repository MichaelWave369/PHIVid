# Evidence-Bearing Render Receipts

This rung turns a successful PHIVid render into an inspectable evidence package.

## Receipt fields

A verified render receipt binds:

- plan id,
- canonical plan SHA-256 digest,
- FFmpeg version string,
- FFprobe version string,
- selected codec encoder,
- CPU/GPU selection class,
- every bound source path, SHA-256, and byte size,
- output path, SHA-256, and byte size,
- FFprobe stream/format facts,
- measured execution duration,
- warnings.

## Emission rule

A render receipt is emitted only after:

1. FFmpeg/FFprobe capability probing succeeds,
2. every declared source asset resolves to an explicit file,
3. source artifacts are hashed,
4. the command builder accepts the plan,
5. FFmpeg exits successfully,
6. the output is a regular file,
7. FFprobe successfully parses the result,
8. the output is hashed.

An encoder merely appearing in `ffmpeg -encoders` is not treated as proof that a hardware render succeeded.

## Warnings

The initial warning vocabulary contains:

- `render_used_cpu_encoder`

Warnings are machine-readable strings so higher-level systems such as ParaCut, WaveForgeStudio, or a Reality Ledger adapter can preserve them without scraping prose.

## Trust boundary

The receipt proves what PHIVid observed locally. It does not prove that the host was authorized to request the render. Authorization remains a host/PhiOS concern.

## Future evidence

Later rungs can add:

- receipt self-hash,
- source expected-hash verification,
- output content-addressed identity,
- FFmpeg command digest,
- machine/GPU facts,
- cancellation state,
- stderr warning extraction,
- signatures,
- Reality Ledger adapter.
