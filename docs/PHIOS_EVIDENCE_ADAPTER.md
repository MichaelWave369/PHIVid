# PhiOS Evidence Envelope Adapter

This rung maps a verified PHIVid render receipt into evidence objects compatible with PhiOS's canonical EvidenceRef contract.

## Grounded PhiOS contract

PhiOS `phios/evidence_ref.py` defines `phios.evidence_ref.v0.1` with:

- `evidence:sha256:<digest>` evidence URIs,
- content SHA-256 identity,
- observed timestamps with timezone,
- sorted and deduplicated transformation lineage,
- a canonical self-hash,
- explicit zero operational, action, and execution authority.

PHIVid mirrors that data shape exactly.

## Boundary

PHIVid does **not**:

- append to the Reality Ledger,
- decide evidence admissibility,
- grant operational authority,
- grant action authority,
- grant execution authority.

It emits a portable envelope. PhiOS remains responsible for admission, policy, and persistence.

## Render lineage

The rendered output EvidenceRef binds lineage to:

- render plan digest,
- FFmpeg command digest,
- verified render receipt digest,
- source artifact content hashes.

Source artifacts get their own EvidenceRefs.

## Envelope

`phivid.phios_evidence_envelope.v0.1` contains:

- source PHIVid receipt digest,
- plan id,
- observed timestamp,
- all PhiOS-compatible EvidenceRefs,
- the output EvidenceRef URI,
- render warnings,
- explicit zero-authority flags,
- an envelope SHA-256 for tamper detection.

The envelope schema belongs to PHIVid. Individual EvidenceRef objects follow PhiOS's schema.

## Next integration

A later PhiOS-side PR may add an admission adapter that parses this envelope with PhiOS's own `EvidenceRef.from_dict()` and decides whether/how it enters the append-only Reality Ledger.
