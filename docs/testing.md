# Testing guide

Run local tests and build from the repository root:

```bash
npm run test:i18n --workspace client
npm test --workspace client
npm run build
npm test --workspace server
npm run test:e2e --workspace client
```

MongoDB tests require `RUN_MONGODB_TESTS=true` and a dedicated database name matching the guard in each suite. Never point runtime tests at a shared, development, staging, or production database. Evidence tests require an isolated temporary directory.

Browser suites must use deterministic accounts, fake notification/SOS/AI/helpline adapters, fake geolocation, and bounded artifacts. Delete test databases, evidence files, browser profiles, traces, screenshots, credentials, sockets, and scheduler leases after execution.

Manual Windows Narrator steps are recorded in `docs/manual-narrator-checklist.md`. Automated axe checks are not a WCAG certification and do not replace human assistive-technology review.
