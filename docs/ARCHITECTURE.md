# PHIVid Architecture

## Role

PHIVid is the video execution/runtime layer beneath ParaCut and other governed hosts.

```text
Human / Agent
      |
      v
ParaCut / PhiOS / WaveForgeStudio
      |
      v
Authority + capability boundary
      |
      v
VideoRenderPlan
      |
      v
PHIVid
  |-- asset registry
  |-- plan validation
  |-- FFprobe / FFmpeg
  |-- hardware selection
  |-- thumbnails / proxies
  |-- captions
  |-- model/provider adapters
  |-- export adapters
      |
      v
Video artifacts + receipts
```

## Ownership boundary

**ParaCut owns what the edit is.**

PHIVid owns how an approved video operation is executed.

A host should be able to replace FFmpeg, switch CPU/NVENC encoders, or add a model provider without changing ParaCut's canonical edit intent.

## Planned modules

- `core`: asset identities, plans, validation, receipts
- `ffmpeg`: command construction and qualified execution
- `hardware`: capability probing and deterministic selection policy
- `proxy`: proxy generation
- `thumbnails`: frame extraction
- `captions`: caption tracks and provider adapters
- `providers`: local/remote generation boundaries
- `exporters`: qualified editor/project export adapters
- `adapters/paracut`: ParaCut render-plan translation
- `adapters/waveforge`: final media handoff
- `adapters/phios`: governed PhiOS capability surface

## Security and correctness

PHIVid must never discover an input by choosing an arbitrary file from a directory. Each job binds to explicit asset identities.

Provider output is data until a declared adapter consumes it. A provider completing successfully must never imply that its result was actually applied.

Network delivery is optional and must be visible in the plan/receipt.
