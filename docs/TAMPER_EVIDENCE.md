# Tamper-Evident Render Receipts

This rung strengthens PHIVid's verified render evidence.

## Source pinning

`VideoSource.sha256` is now authoritative when present.

Before FFmpeg executes, PHIVid:

1. resolves the source asset to its explicit file path,
2. hashes the file with SHA-256,
3. validates the declared expected hash format,
4. compares expected and actual bytes,
5. aborts on mismatch.

No output render is started after a source-hash mismatch.

## Command digest

Every verified receipt includes:

`commandDigest = SHA256(canonical({ executable, args }))`

The digest binds the exact FFmpeg executable string and argument vector selected by PHIVid.

It intentionally hashes an argument array, not a shell command string.

## Receipt digest

Receipt schema v0.2 adds `receiptDigest`.

The value is SHA-256 over the canonical receipt payload **excluding the receiptDigest field itself**. This avoids the impossible circular requirement of hashing a value that contains its own hash.

`verifyRenderReceiptDigest()` recomputes the payload digest and detects mutation.

## What this proves

A valid receipt can show that PHIVid observed:

- specific source bytes,
- a specific render plan,
- a specific FFmpeg invocation,
- specific tool versions,
- a specific selected encoder,
- specific output bytes,
- specific FFprobe facts.

It still does not prove operator authorization or identity. Those remain higher-level governance concerns.

## Next boundary

The next integration rung can adapt this receipt into PhiOS / Reality Ledger event envelopes without making PHIVid itself own the ledger.
