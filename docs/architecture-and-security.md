# Architecture and security

SatyaShield separates public reporting, complaint-scoped reporter access, and staff authentication. The browser never stores reporter access credentials or staff access tokens in persistent web storage. Staff refresh credentials use rotating HttpOnly cookies with CSRF protection.

## Trust boundaries

- Public intake accepts a minimized complaint payload and optional evidence.
- A reporter receives a case ID and access secret once. MongoDB stores only a keyed secret hash.
- Reporter tokens are short-lived, audience-restricted, and scoped to one complaint.
- Staff tokens use a separate key, purpose, issuer, audience, and account version.
- Authorization defaults to deny and checks the exact complaint assignment for every role.
- Evidence is validated, encrypted with authenticated encryption, and stored outside the public web root.
- Socket.IO credentials travel in the authentication payload, not URLs, and access is rechecked.
- SOS is an internal workflow. External delivery is rejected by configuration.

## Threat model summary

Controls address credential theft, token confusion, CSRF, unsafe CORS, horizontal case access, reassignment races, path traversal, malicious filenames, evidence tampering, NoSQL operator injection, replay, scheduler duplication, log leakage, and location overexposure. Rate limits and generic reporter-access errors reduce credential enumeration.

Residual risks include compromised client devices, browser/network metadata, social engineering, unavailable providers, unscanned files, single-instance realtime operation, short access-token revocation delay, and operational misuse by an otherwise authorized account.

## Evidence, routing, triage, chat, and SOS

Evidence lifecycle states prevent unavailable, rejected, quarantined, missing, or pending files from being downloaded. NGO matching is deterministic and capacity-aware; pre-acknowledgment views are minimized. Triage uses structured answers and explicit rules, not narrative keyword scoring. Critical results require human review and do not trigger dispatch. Chat is server-persisted and encrypted in transit and at rest, but it is not end-to-end encrypted. SOS requires confirmation and supports cancellation and optional one-time minimized location.

## Case integrity foundation

Case integrity is independent from safety triage. New complaints receive an immutable, versioned assessment. Exact normalized narrative matches use a purpose-versioned keyed HMAC; the normalized narrative is not stored. Candidate lookup is time-bounded and capped, and creates internal reversible links for future human review. A match never rejects, hides, closes, downgrades, reroutes, or revokes reporter access to a complaint. Approximate similarity, malicious-abuse decisions, reviewer conflict declarations, dual approval, and appeals are not yet implemented. See `case-integrity-decision-record.md`.
