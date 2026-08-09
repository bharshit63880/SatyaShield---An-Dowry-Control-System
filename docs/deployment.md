# Deployment guide

SatyaShield is not approved for production deployment. A deployment candidate must use `NODE_ENV=production`, HTTPS, explicit HTTPS origins, secure cookies, a narrowly configured proxy trust mode, separate strong secrets, MongoDB TLS and least-privilege credentials, private evidence storage, a real malware scanner, privacy-safe monitoring, and tested backup restoration.

External AI and SOS delivery must remain disabled. Test adapters and debug routes must not be available. Bootstrap credentials must be removed after controlled account provisioning. Retention mode must be explicit.

Production startup deliberately rejects local evidence storage and the development scanner bypass. Configure `EVIDENCE_STORAGE_PROVIDER=object`, a private bucket/region/credential set, and `EVIDENCE_SCANNER_MODE=http` with an authenticated scanner endpoint. Objects are application-encrypted before upload, never use a public ACL, enter quarantine first, and are promoted only after a clean scan. Use a least-privilege object identity restricted to the configured bucket and prefix; do not reuse database or deployment credentials.

Socket.IO must remain single-instance while the memory adapter is configured. Multi-instance deployment requires a tested shared adapter and immediate-revocation verification.

Readiness checks must verify database access, private storage, encryption-key availability, scheduler ownership, and provider configuration without exposing secrets. Health checks must not disclose dependencies or configuration.

Required branch-protection checks are `local-validation` and, before a controlled release, a successful manually dispatched `guarded-atlas-regression` against an isolated `ss_p10_rt_*` database. Require pull-request review and disallow force pushes. These are repository-setting instructions only; this project does not claim the remote settings were changed.

Roll back application code to the last verified immutable deployment without rolling back MongoDB records or evidence objects blindly. Schema changes require a dry-run inventory, a tested forward/rollback procedure, and a backup whose restoration has been measured in an isolated environment.
