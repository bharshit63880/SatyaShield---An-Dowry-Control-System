# Deployment guide

SatyaShield is not approved for production deployment. A deployment candidate must use `NODE_ENV=production`, HTTPS, explicit HTTPS origins, secure cookies, a narrowly configured proxy trust mode, separate strong secrets, MongoDB TLS and least-privilege credentials, private evidence storage, a real malware scanner, privacy-safe monitoring, and tested backup restoration.

External AI and SOS delivery must remain disabled. Test adapters and debug routes must not be available. Bootstrap credentials must be removed after controlled account provisioning. Retention mode must be explicit.

Socket.IO must remain single-instance while the memory adapter is configured. Multi-instance deployment requires a tested shared adapter and immediate-revocation verification.

Readiness checks must verify database access, private storage, encryption-key availability, scheduler ownership, and provider configuration without exposing secrets. Health checks must not disclose dependencies or configuration.
