# Lineage

PHIVid is a clean-room continuation of earlier **PHIVidLocal** and **PHIVidOnline** prototypes.

Those prototypes demonstrated useful ideas including:

- FFmpeg/FFprobe integration
- trimming, overlays, fades, normalization, and transcoding
- thumbnail generation
- project/export adapters
- local gallery/storage concepts
- optional Google Drive and Frame.io delivery
- ComfyUI/provider orchestration experiments

The old implementations are treated as **reference material**, not production source.

## Why selective salvage is required

Historical issues discovered during review include:

- local builds retaining imports for cloud-only modules,
- a route importing a module absent from the archive,
- jobs selecting the first video in an upload directory instead of binding an explicit source asset,
- provider results being produced but not consumed by the FFmpeg execution path,
- orchestration descriptions that were not yet executable provider graphs,
- CPU `libx264` use despite documentation implying broad GPU acceleration,
- no test suite protecting these boundaries.

These are useful lessons. They are not defects we need to preserve for nostalgia.

## Relationship to the current ecosystem

The intended primary relationship is:

```text
ParaCut -> PHIVid
```

ParaCut remains the edit/timeline authority. PHIVid remains independently callable by PhiOS, WaveForgeStudio, CineSwarm, and agent workflows.
