# SatyaShield

SatyaShield is a privacy-focused MERN application for reporting dowry harassment, tracking a case with complaint-scoped credentials, and coordinating authorized NGO, investigator, and administrative workflows.

> SatyaShield is not an emergency-dispatch service. It does not guarantee police, ambulance, NGO, message-delivery, or response outcomes.

## Project progress

### Engineering roadmap: approximately 65% complete

This percentage measures the approved 16-phase engineering roadmap—not production readiness.

| Work area | Status |
|---|---|
| Phases 1–10 | Verified with dedicated MongoDB Atlas runtime tests |
| Phase 11 | Accessibility, Quick Exit, inactivity locking, and localization foundations implemented; full bilingual migration and full-stack browser E2E remain incomplete |
| Phases 12–16 | Not started |
| Production readiness | Not approved |

Completed and verified work includes reporter access security, resource-level authorization, the encrypted evidence vault, privacy hardening, staff authentication and MFA, NGO routing, deterministic triage, escalation scheduling, secure realtime chat, and internal-only SOS workflows.

Remaining roadmap work includes complete English/Hindi coverage, full browser-driven E2E and manual accessibility review, notification-provider architecture, reviewed legal-information content, CI/security automation, production infrastructure hardening, and the final readiness review.

## Screenshots

### Home

![SatyaShield home screen](docs/screenshots/home.png)

### Anonymous complaint intake

![SatyaShield anonymous complaint form](docs/screenshots/anonymous-report.png)

### Authorized staff login

![SatyaShield operator login](docs/screenshots/operator-login.png)

## Implemented security architecture

- Complaint-scoped reporter case ID and one-time access secret.
- Only a keyed reporter-secret hash is stored.
- Reporter and staff authentication remain separate.
- Exact-case authorization for reporters, NGOs, investigators, admins, and superadmins.
- Encrypted private evidence storage with lifecycle and integrity controls.
- HttpOnly refresh cookies, CSRF protection, explicit CORS, token rotation, and reuse detection.
- TOTP MFA, recovery codes, account-state enforcement, and session revocation.
- Deterministic NGO eligibility, routing, capacity, assignment, and revocation.
- Structured deterministic triage with Critical-case human review.
- Versioned internal deadlines, escalation policies, and idempotent scheduler leasing.
- Complaint-scoped Socket.IO chat with persistence and immediate authorization revocation.
- Explicit SOS confirmation and cancellation with optional encrypted, minimized location.
- Internal-only SOS routing; external emergency delivery remains disabled.
- Reviewable helpline architecture with no unverified production entries.
- Privacy-safe logs and audit allowlists.
- External AI disabled and fail-closed.

Chat is not end-to-end encrypted. Evidence is not claimed to be malware-free. Complete anonymity, guaranteed deletion, legal certification, and production readiness are not claimed.

## Technology

- React 18, Vite, Tailwind CSS, React Router
- Node.js and Express
- MongoDB Atlas with Mongoose
- Socket.IO
- JWT, rotating refresh tokens, TOTP, AES-GCM, HMAC, and scrypt
- Node test runner, Playwright, and axe-core

## Local setup

Requirements:

- Node.js 20.12 or newer
- npm
- A dedicated development MongoDB database

```bash
git clone https://github.com/bharshit63880/SatyaShield.git
cd SatyaShield
npm install
```

Copy the example environment files and provision unique development secrets:

```powershell
Copy-Item server/.env.example server/.env
Copy-Item client/.env.example client/.env
```

Never commit `.env` files or reuse development secrets in production.

Start the frontend and backend:

```bash
npm run dev
```

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:5000`

## Validation

```bash
npm test
npm run build
npm run test:mongodb
npm run test:e2e --workspace client
```

Current recorded verification:

- MongoDB Atlas Phase 1–10 suites: 9/9 passed.
- Local backend suite: 44 passed.
- Client contract suite: 15/15 passed.
- Focused desktop/mobile Chromium E2E and accessibility suite: 16/16 passed.
- Automated serious/critical accessibility findings on tested public routes: zero.
- Deterministic MFA authenticated-tag tamper trials: 5,000/5,000 passed.

Phase 11 is not fully verified because complete bilingual migration and the required full-stack browser flows remain pending.

## Important limitations

- No production helplines are published.
- No real external SOS or emergency-service delivery exists.
- Socket.IO currently supports one application instance; multi-instance operation requires a shared adapter.
- Real email delivery and deployed TLS-cookie behaviour are unverified.
- Password history is not implemented.
- Short-lived revoked access tokens may remain usable until expiry.
- A production malware scanner is not configured.
- Production secrets, monitoring, backup restoration, legal review, and manual accessibility review remain outstanding.
- Known dependency-audit findings require manual review; no breaking automatic audit fix has been applied.

## Repository structure

```text
SatyaShield/
├── client/   # React frontend, browser tests, accessibility and UI contracts
├── server/   # Express API, MongoDB models, security services and runtime tests
└── docs/
    └── screenshots/
```

## Responsible development

Use dedicated test databases and fake adapters. Do not contact real emergency services or helplines during automated testing. Do not enable external AI or external SOS delivery without a separately reviewed and verified phase.
