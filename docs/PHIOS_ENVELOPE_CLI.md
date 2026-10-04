# phivid-phios-envelope CLI Qualification

This rung exposes PHIVid's PhiOS evidence adapter as a deterministic file-to-file command.

## Command

```bash
phivid-phios-envelope \
  --receipt render/phivid_render_receipt.json \
  --out evidence/phivid-envelope.json \
  --observed-at 2026-10-04T22:56:00Z
```

## Determinism

The command does not consult the wall clock. `--observed-at` is mandatory.

Running the command twice with the same verified receipt, output path, and observation timestamp produces identical envelope bytes.

## Admission boundary

The CLI:

- verifies the PHIVid render receipt digest,
- creates PhiOS-compatible EvidenceRefs,
- preserves zero operational/action/execution authority,
- writes one self-hashed PHIVid evidence envelope.

It does not append to the PhiOS Reality Ledger and does not claim evidence admissibility.

## Path safety

The output path must be relative and may not traverse with `..`.

Input receipt files may be specified by normal local filesystem paths because they are read-only inputs supplied by the caller.

## Next integration

PhiOS can invoke or consume this file-level contract and validate every embedded EvidenceRef using its own `EvidenceRef.from_dict()` before any ledger admission decision.
