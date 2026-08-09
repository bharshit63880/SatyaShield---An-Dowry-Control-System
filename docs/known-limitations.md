# Known limitations

- No real email or notification provider is configured or runtime-verified.
- Production HTTPS cookie behavior is not verified in a deployed TLS environment.
- Recent password history is implemented, but its configured depth and operational reset process still require policy review.
- Revoked access tokens may remain usable for their short configured lifetime.
- Durable private object storage and an authenticated scanner adapter are implemented, but no production bucket, scanner, credentials, or provider runtime has been provisioned or verified.
- Socket.IO supports one application instance with the memory adapter.
- The escalation worker has database leases and a separate entry point, but production worker hosting and heartbeat monitoring are not provisioned.
- No production helplines are published.
- SOS does not contact external emergency services.
- Chat is not end-to-end encrypted.
- Hindi and legal/privacy content lack qualified external review.
- Windows Narrator review requires human execution.
- Production monitoring, NGO operating agreements, incident exercises, and backup restoration are not operationally verified.
- The compatible React Router release line retains a moderate redirect advisory; a breaking major upgrade remains pending dedicated migration testing.
- Complete anonymity, guaranteed deletion, guaranteed response, legal certification, and production readiness are not claimed.
