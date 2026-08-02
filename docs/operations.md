# Operations, backup, and incident response

MongoDB records and encrypted evidence objects form one logical recovery set. Backups must preserve database-to-object consistency, encryption-key versions, legal holds, and retention metadata. Losing an encryption key can make evidence irrecoverable; storing keys with the same backup defeats isolation.

Restore drills must use isolated fixtures and verify record counts, evidence authentication, authorization boundaries, and cleanup. Recovery-point and recovery-time values are operational goals only until measured in the deployed environment.

Incident procedures must cover credential compromise, token/key rotation, database outage, provider outage, storage corruption, scheduler lease failure, socket revocation failure, privacy leakage, and rollback. Rotation must distinguish reporter HMAC, reporter token, staff access token, refresh pepper, MFA encryption, location encryption, and evidence encryption keys.

Monitoring must use allowlisted, redacted events. Never record complaint narratives, credentials, MFA/recovery values, evidence paths, exact SOS coordinates, or raw IP/user-agent telemetry.
