# Known limitations

- No real email or notification provider is configured or runtime-verified.
- Production HTTPS cookie behavior is not verified in a deployed TLS environment.
- Password history is not implemented.
- Revoked access tokens may remain usable for their short configured lifetime.
- No production malware scanner is configured.
- Socket.IO supports one application instance with the memory adapter.
- No production helplines are published.
- SOS does not contact external emergency services.
- Chat is not end-to-end encrypted.
- Hindi and legal/privacy content lack qualified external review.
- Windows Narrator review requires human execution.
- Production monitoring, NGO operating agreements, incident exercises, and backup restoration are not operationally verified.
- Case integrity currently detects only bounded exact normalized narrative matches. Approximate similarity, evidence-hash correlation, privacy-preserving network signals, reviewer conflict/recusal, dual adverse approval, appeal APIs, reviewer anomaly metrics, and the restricted review UI remain unimplemented.
- Complete anonymity, guaranteed deletion, guaranteed response, legal certification, and production readiness are not claimed.
