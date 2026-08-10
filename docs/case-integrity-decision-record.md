# Case integrity hardening decision record

Status: implementation baseline, not production approval
Scope: first coherent hardening increment only

## Verified observations

- The application is a modular Express/React monolith backed by MongoDB. Complaint creation and deterministic triage are coordinated in `server/src/services/complaint.service.js`.
- Reporter credentials are purpose-separated from staff tokens and only the reporter-secret hash is stored (`server/src/utils/reporter-access.js`, `server/src/models/complaint.model.js`).
- Exact-case staff authorization is centralized and defaults to deny (`server/src/services/authorization.service.js`).
- Evidence is signature-validated, encrypted, and stored through a private provider boundary, but production malware scanning and durable object storage are not configured (`server/src/services/evidence-vault.service.js`).
- Triage uses structured answers and immutable assessment versions; it does not inspect narratives for severity (`server/src/services/triage.service.js`).
- Rate limits are process-local and Socket.IO uses a single-instance memory adapter (`server/src/config/rate-limit.js`, `server/src/services/socket-chat.service.js`).
- Audit metadata is allowlisted and resource references are one-way, but audit records are not cryptographically chained (`server/src/services/audit.service.js`).
- Retention is dry-run reporting only (`server/src/services/retention.service.js`).
- The deployed public pages were reachable without console errors during the 2026-08-10 smoke test. Mobile language switching worked, but ten structured safety-question labels remained English in Hindi mode.

## Existing capability matrix

| Capability | State | Evidence |
| --- | --- | --- |
| Reporter case credentials | Present | `reporter-access.js`, `reporter-access.middleware.js` |
| MFA and recovery | Present | `auth.service.js`, `recovery-code.model.js` |
| CSRF protection | Present | `csrf.middleware.js`, auth cookie controller |
| Refresh rotation | Present | `auth.service.js`, `session.model.js` |
| Evidence encryption | Present locally | `local-private-storage.provider.js` |
| Malware scanning | Partial/fail-closed | `evidence-scanner.service.js` has no production adapter |
| Exact-case authorization | Present | `authorization.service.js` |
| NGO assignment revocation | Present | `ngo-assignment.service.js`, realtime revocation service |
| Triage history | Present | `triage-assessment.model.js` |
| Duplicate-report controls | Missing before this increment | No integrity assessment or link model existed |
| Malicious-report workflow | Missing | No adverse integrity decision workflow existed |
| Appeal/reconsideration | Missing | No integrity appeal lifecycle existed |
| Socket multi-instance support | Missing | memory adapter, explicit single-instance mode |
| Audit-log integrity | Partial | allowlisted audit data; no chained integrity |
| Backup restoration | Documented only | `docs/operations.md` |
| Retention enforcement | Partial | dry-run report only |

## Threat and abuse cases

| Threat | Entry point | Existing control | Gap | Selected control | Residual risk | Test |
| --- | --- | --- | --- | --- | --- | --- |
| Bulk duplicate complaints | Public intake | rate limit | distributed evasion; no case linkage | exact normalized narrative HMAC and bounded candidate review | paraphrases are not detected | deterministic fingerprint and candidate tests |
| Retaliatory counter-report | Public intake | human triage | no integrity dimension | neutral review flag independent of safety | context still requires trained review | safety-independence test |
| Complaint enumeration | case access | generic errors, rate limit | process-local limiter | unchanged; shared limiter remains an infrastructure gate | multi-instance evasion | existing negative HTTP tests |
| Malware upload | evidence intake | signatures, quarantine lifecycle | no production scanner | retain fail-closed scanner requirement | scanner/provider outage | existing validation and vault tests |
| Unassigned case access | staff and sockets | exact assignment ABAC | compromised administrator | integrity queue gets separate policy actions | privileged misuse | policy negative tests |
| Reviewer silences reporter | integrity review | none before this increment | no dual control/appeal | foundation reserves dual-review and appeal states; adverse decisions are not implemented | workflow still pending | policy tests and future integration tests |
| Duplicate scheduler execution | scheduler | leases/idempotency | no transactional outbox | unchanged in this increment | crash windows remain | existing workflow tests |
| Database/operator tampering | database | audit trail | no tamper-evident chain | documented for next phase | database administrator can alter records | future chain verification test |

## Trust boundaries and attacker personas

Trust boundaries are the public intake, reporter credential exchange, staff session boundary, exact complaint assignment, private evidence provider, MongoDB, Socket.IO rooms, scheduler, and disabled external providers. Relevant adversaries include bulk submitters, retaliatory reporters, credential replay attackers, malicious uploaders, compromised staff, abusive reviewers, database operators, stale socket clients, and availability attackers.

## Bottlenecks and failure scenarios

- CPU: scrypt authentication, image validation, authenticated encryption, and future similarity calculations.
- Memory: multipart evidence buffers and Socket.IO connection state.
- Disk I/O: local encrypted evidence is unsuitable for horizontally scaled or ephemeral production hosts.
- Database: growing queues need bounded indexed queries; audit and assessment history are append-heavy.
- Network: Render cold starts, Atlas connection limits, evidence upload bandwidth, and provider timeouts.
- Critical failures: encryption-key loss, scanner outage, database/object inconsistency, stale authorization, duplicate scheduler work, and false adverse integrity decisions.

## Architecture decision

Implement deterministic exact-narrative candidate detection inside the existing modular monolith. The normalized narrative is never stored. A purpose-separated keyed HMAC is stored as an internal, non-selected field and queried only within a bounded time window. Matching creates an immutable assessment and reversible case link for human review. It never changes triage severity, routing, reporter access, evidence availability, or case visibility.

Rejected for this increment:

- External AI or embeddings: unnecessary disclosure of sensitive narratives and opaque behavior.
- Raw IP/device fingerprinting: excessive surveillance and weak identity evidence.
- Redis/Kafka/microservices: no measured throughput requirement justifies the operational cost.
- Automatic rejection or downgrade: unsafe, particularly for Critical or trauma-affected reports.
- Approximate similarity: requires measured thresholds and false-positive evaluation before use.

## Consistency, privacy, and rollback

Complaint creation compensates integrity records if assessment creation fails. Assessment version and current-record indexes prevent conflicting current state. Case links are separate documents to avoid unbounded complaint arrays. Rollback consists of stopping assessment creation and removing the additive current-integrity fields; historical internal records may then be retained or deleted under an approved migration and retention decision.

No raw IP, device fingerprint, reporter secret, token, normalized narrative, identity field, exact location, or external AI payload is added. The HMAC key remains outside MongoDB and uses an explicit purpose/version domain.

## Database indexes and migration

| Index | Query supported | Cardinality and complexity | Cost and type |
| --- | --- | --- | --- |
| assessment `{ complaintId, assessmentVersion }` | immutable history lookup | high-cardinality complaint ID; O(log n + history) | unique compound; one write per assessment |
| assessment `{ complaintId, isCurrent }` | exact current assessment | one current row per complaint; O(log n) | unique partial compound; small additional write cost |
| assessment `{ status, reviewRequired, reviewDeadlineAt, generatedAt }` | oldest restricted review work | low-cardinality prefix plus ordered deadline; O(log n + page) | partial queue index; only current review-required rows |
| assessment `{ narrativeFingerprint, generatedAt }` | bounded exact-duplicate candidates | high-cardinality HMAC; O(log n + at most 20) | partial compound; internal fingerprint only |
| case link `{ sourceComplaintId, candidateComplaintId, linkType }` | idempotent exact link creation | high-cardinality pair; O(log n) | unique compound; one row per candidate link |
| case link `{ status, createdAt }` | active/reversed link review | low-cardinality prefix; O(log n + page) | compound history index |

Write amplification is bounded to one assessment and zero-to-twenty links per complaint. No TTL deletion is enabled for assessments because legal holds and complaint/evidence retention must remain coordinated. `expiresAt` records eligibility; a later approved retention worker must enforce it.

The schema change is additive. Existing complaints remain with `currentIntegrityStatus=null` and are not silently assessed. A future backfill must run as a separately approved, rate-limited, resumable dry-run-first migration, must not send narratives externally, and must not create adverse decisions. Safe rollback disables new assessment creation, removes the additive current fields in a controlled migration if necessary, and retains or deletes historical records only under the approved retention policy.

## Implementation sequence

1. Add versioned neutral registries and default-deny integrity policy actions.
2. Add immutable assessment and reversible case-link schemas with bounded indexes.
3. Create exact normalized narrative fingerprints and bounded candidate lookup.
4. Integrate initial assessment with complaint creation without changing safety triage.
5. Add deterministic and negative tests plus documentation.
6. Defer adverse decisions, dual approval, reviewer conflicts, appeal APIs, network pseudonyms, approximate similarity, audit chaining, and UI queues to later coherent increments.
