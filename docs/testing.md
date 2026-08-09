# Testing guide

Run local tests and build from the repository root:

```bash
npm run test:i18n --workspace client
npm test --workspace client
npm run build
npm test --workspace server
npm run test:e2e --workspace client
```

MongoDB tests are excluded from the default server test command and are imported only by the guarded runtime runner. They require `RUN_MONGODB_TESTS=true` and a dedicated database name matching `ss_p10_rt_*`. The runner rejects missing, development, staging, shared, and production database names before importing application modules. Never point runtime tests at existing user data. Evidence tests require an isolated temporary directory.

Browser suites must use deterministic accounts, fake notification/SOS/AI/helpline adapters, fake geolocation, and bounded artifacts. Delete test databases, evidence files, browser profiles, traces, screenshots, credentials, sockets, and scheduler leases after execution.

The production dependency audit currently tolerates moderate findings because React Router 6 has no compatible patched release. High or critical production findings fail CI. Do not run `npm audit fix --force`; the React Router and Vite major upgrades require isolated migration and regression work.

Manual Windows Narrator steps are recorded in `docs/manual-narrator-checklist.md`. Automated axe checks are not a WCAG certification and do not replace human assistive-technology review.
