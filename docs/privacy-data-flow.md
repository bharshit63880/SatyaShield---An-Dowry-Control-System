# Privacy data flow

The public form avoids name, phone, email, exact address, and exact GPS fields. Complaint narrative, structured safety answers, optional city/district, consent records, workflow data, and optional evidence are stored to operate a case.

Reporter secrets, raw session tokens, MFA secrets, recovery codes, exact evidence storage paths, and restricted SOS coordinates are excluded from public serializers and logs. Audit records use allowlisted metadata and one-way resource references. Operational logging recursively redacts sensitive keys.

Quick Exit clears in-page reporter state, closes the case socket, broadcasts a cross-tab lock, and replaces the current history entry. It cannot erase browser, device, network-provider, DNS, proxy, employer, backup, or screenshot history.

Retention eligibility is reported using versioned policy metadata. Automatic deletion is not enabled, and legal holds may prevent deletion. Complete anonymity or guaranteed deletion is not claimed.
