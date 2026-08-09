# Operations, backup, and incident response

MongoDB records and encrypted evidence objects form one logical recovery set. Backups must preserve database-to-object consistency, encryption-key versions, legal holds, and retention metadata. Losing an encryption key can make evidence irrecoverable; storing keys with the same backup defeats isolation.

Restore drills must use isolated fixtures and verify record counts, evidence authentication, authorization boundaries, and cleanup. Recovery-point and recovery-time values are operational goals only until measured in the deployed environment.

Incident procedures must cover credential compromise, token/key rotation, database outage, provider outage, storage corruption, scheduler lease failure, socket revocation failure, privacy leakage, and rollback. Rotation must distinguish reporter HMAC, reporter token, staff access token, refresh pepper, MFA encryption, location encryption, and evidence encryption keys.

Monitoring must use allowlisted, redacted events. Never record complaint narratives, credentials, MFA/recovery values, evidence paths, exact SOS coordinates, or raw IP/user-agent telemetry.

## Rotation sequence

Provision a new versioned secret, deploy code that accepts the old and new verification versions where supported, move signing/encryption to the new key, verify bounded synthetic flows, then retire the old key after the longest relevant token/data window. Evidence-key rotation additionally requires a resumable, authenticated re-encryption migration and must never discard the old key before every referenced object is verified.

## Restore drill checklist

1. Restore a dedicated test snapshot and private-object prefix into an isolated account/network.
2. Verify database counts, policy versions, legal holds, and object references without logging identifiers.
3. Authenticate sample encrypted evidence and confirm exact-resource authorization still denies cross-case access.
4. Measure recovery time and recovery point, record failures, then destroy the isolated restore and credentials.
5. Do not promote an unmeasured target into a recovery-time or recovery-point guarantee.

## Provider incidents

Storage or scanner outages must leave new evidence unavailable. Notification outages must retry bounded metadata-only messages and ultimately enter manual review. Realtime adapter outages must fall back to reconnect/recovery semantics, never loosen authorization. External SOS delivery and external AI remain disabled.
