# PHIVid

**PHIVid** is a sovereign video-processing and render runtime for the Φ creative ecosystem.

Its primary editor integration is ParaCut, but the runtime remains independently callable by PhiOS, WaveForgeStudio, CineSwarm, agents, and future media tools.

## Status

**v0.1.0 foundation candidate**

This repository currently establishes the runtime boundary, typed render-plan contracts, validation, deterministic receipts, tests, CI, architecture, and project lineage. Legacy PHIVid code is intentionally **not** imported yet.

## Principles

- **Runtime, not editor.** ParaCut owns editing UX and timeline authority; PHIVid executes governed video operations.
- **Capability ≠ authority.** Available render capabilities do not bypass host policy.
- **Asset identity matters.** Jobs must bind to explicit assets, never “the first video in a folder.”
- **Provider-independent.** FFmpeg, hardware encoders, local models, or remote generation providers sit behind adapters.
- **Deterministic plans.** Render intent should be hashable, replayable, and inspectable.
- **Local-first.** Cloud delivery is an optional adapter.
- **Evidence-bearing outputs.** Rendering should eventually emit hashes, encoder facts, warnings, and receipts.

## Initial boundary

PHIVid owns:

- video asset identities
- render-plan contracts
- plan validation
- deterministic operation receipts
- future FFmpeg/hardware/provider adapters
- future proxy/thumbnail/caption/export services

PHIVid does **not** own:

- ParaCut's editing UI or project authority
- WaveForgeStudio's release/mastering authority
- unrestricted file-system discovery
- hidden cloud dependencies
- arbitrary model execution without an adapter and grant

## Development

```bash
npm install
npm run typecheck
npm test
```

## Roadmap

1. Foundation contracts, validation, receipts, and CI.
2. Add a qualified FFprobe/FFmpeg adapter.
3. Add explicit asset registry and job binding.
4. Add thumbnails and proxies.
5. Add hardware capability detection and NVENC/CPU fallback.
6. Add ParaCut render-plan adapter.
7. Add captions and model/provider adapters.
8. Add editor/export adapters only with qualification fixtures.

See [Architecture](docs/ARCHITECTURE.md) and [Lineage](docs/LINEAGE.md).

## License

MIT. See [LICENSE](LICENSE).
