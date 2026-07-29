# Evidence vault security policy

## Storage and encryption

Local development/testing uses `LocalPrivateStorageProvider`, rooted outside the former public
uploads directory. Objects use random 256-bit identifiers and AES-256-GCM with a new 96-bit nonce
per object. The stored envelope contains a format marker, nonce, authentication tag, and
ciphertext. The complete bounded object is authenticated and decrypted before any response bytes
are released.

`EVIDENCE_ENCRYPTION_KEY` is a dedicated 32-byte key encoded as 64 hexadecimal characters.
The server refuses to start without it in every environment. `EVIDENCE_ENCRYPTION_VERSION` records the current version,
but online key rotation and multi-key decryption are not implemented; rotation requires a
controlled re-encryption migration.

Cloud/private object storage can be added behind the provider contract documented in
`src/services/storage/README.md`. Provider URLs and object keys must remain server-only.

## Validation support

Supported uploads are JPEG, PNG, and WebP images with matching filenames, declared MIME types,
and server-inspected signatures. Empty, oversized, mismatched, malformed/truncated, HTML, SVG,
JavaScript, executable, archive, PDF, MP4, and all other formats are rejected. PDF and video remain
disabled because this phase does not include a sufficiently strong active-content/video parser.

Signature validation is not malware detection and does not establish that a file is harmless.

## Scanning policy

The scanner interface is intentionally adapter-based. No real malware scanner is bundled.
Production defaults to `EVIDENCE_SCANNER_MODE=required`; scanner absence or failure leaves evidence
in `pending_scan`, which cannot be downloaded. Non-production environments may explicitly select
`development-bypass`; validated files then become `available` with `scanStatus=not_configured`.
The UI must describe that state accurately and must not call it virus-free.

## Lifecycle

New evidence transitions through `pending_scan` and then to `available`, `quarantined`, or remains
pending on scanner failure. `rejected`, `deleted`, `missing`, `quarantined`, `pending_scan`, and
`legacy_unmigrated` evidence is not downloadable. Evidence history records safe lifecycle/access
events without file contents, keys, storage identifiers, or reporter credentials.

## Legacy evidence

Legacy `/uploads` records are fail-closed as `legacy_unmigrated`; `/uploads` is not statically
served. `npm run evidence:legacy-inventory --workspace server` is read-only. The separate
`evidence:legacy-migrate` command requires an explicit operator decision: it validates each
available legacy file, encrypts it into private storage, records verified metadata, and leaves it
`pending_scan`. It does not delete the original legacy file. Missing files become `missing`.
