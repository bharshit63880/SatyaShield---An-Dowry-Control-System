# Changelog

## Unreleased

### Added

- Complete English and Hindi interface catalogs with automated key-parity and visible-string inventory checks.
- Full-stack Playwright coverage for reporter, NGO, investigator, administrator, evidence, chat, SOS, responsive, and reduced-motion journeys.
- Desktop and mobile axe checks for representative public and authenticated pages.
- Provider-neutral, idempotent notification workflow with versioned bilingual templates and signed webhook validation.
- Review-gated legal-information records with citations, expiry, approval, and publication controls.
- Least-privilege CI validation, guarded Atlas testing, secret checks, deployment guidance, operational runbooks, and accessibility documentation.

### Changed

- Removed simulated partner activity and unsupported service metrics from the public homepage.
- Corrected one-time reporter locking across tabs and the MFA recovery-code login flow.
- Updated production image processing dependencies for current security fixes.

### Security

- External AI and external SOS delivery remain disabled.
- Evidence remains private and fail-closed when a production scanner is unavailable.
- No real notification, emergency-service, or helpline delivery is enabled.
