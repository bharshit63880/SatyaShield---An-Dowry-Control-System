# SatyaShield Windows Narrator checkpoint

This is a human verification checklist, not a completed accessibility certification.

## Test setup

- Windows Narrator with Microsoft Edge or Chromium.
- Use a dedicated test account, complaint, database, and evidence directory.
- Keep external AI, notification delivery, SOS delivery, and real helplines disabled.
- Run once in English and once in Hindi.

## Checks

1. Language switcher
   - Narrator announces the language selector, current value, and changed value.
   - The document language changes without moving focus or clearing entered form data.

2. Complaint form
   - Every input has an announced label, required state, hint, and error association.
   - Submitting invalid data moves focus to the validation summary.
   - Structured safety questions and “prefer not to say” choices are understandable.

3. One-time credentials
   - The success heading receives focus.
   - Case ID, access secret, one-time warning, copy actions, and recovery-card action are announced.
   - The warning clearly says the secret cannot be displayed or recovered later.

4. Inactivity warning
   - The alert dialog interrupts appropriately, traps focus, announces remaining time, and exposes both actions.
   - Continuing restores focus; locking moves to the safe locked state.

5. Quick Exit
   - The button name and Alt+Q shortcut are announced.
   - Activation leaves the sensitive page without announcing case details afterward.

6. Evidence
   - File selection, upload progress, success, rejected, unavailable, and download states are announced.
   - Evidence metadata is understandable without exposing a storage path.

7. Chat and reconnection
   - New messages are announced once without moving typing focus.
   - Connecting, disconnected, reconnecting, recovered messages, and access-revoked states are announced.

8. SOS safety request
   - Confirmation, non-dispatch warning, countdown, cancellation, active, expired, and failure states are announced.
   - Location-off, permission-granted, and permission-denied states are distinguishable.

9. MFA
   - MFA challenge, authenticator code, recovery-code alternative, invalid code, and success are announced.
   - Recovery codes are identified as single-use and shown only once.

10. Session expiry
    - Expiry and safe refresh failure are announced.
    - Focus moves to the login heading without exposing previous sensitive content.

11. Assignment revocation
    - NGO or investigator access revocation is announced immediately.
    - Case details and chat are no longer reachable after the announcement.

## Human record

- Tester:
- Date:
- Windows version:
- Narrator version:
- Browser and version:
- English result:
- Hindi result:
- Issues found:
- Retest result:

