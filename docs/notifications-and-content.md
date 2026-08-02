# Notifications and reviewed content

## Notification workflow

Notifications use versioned English/Hindi templates, exact variable allowlists, server-side recipient resolution, hashed references, idempotency keys, bounded attempts, timeout handling, retry scheduling, and safe failure categories. Supported states are `created`, `queued`, `processing`, `provider_accepted`, `delivered`, `failed`, `retry_scheduled`, `skipped_not_configured`, `suppressed`, and `permanently_failed`.

`delivered` is permitted only after verified provider evidence. Signed webhooks require a timestamp, nonce, HMAC validation, and replay rejection. The deterministic fake provider is test-only. No real provider is configured or verified.

Templates must not include complaint narratives, reporter secrets, evidence links, exact location, authentication credentials, or staff-private notes.

## Reviewed information

General legal information, evidence preservation, digital safety, complaint process, privacy, NGO support, non-dispatch guidance, and safety resources use a versioned lifecycle: draft, under review, approved, published, review due, withdrawn, and archived.

Draft or expired content fails closed. Substantive entries require citations and a review-due date. Hindi content has independent review status. Published content is general information, not personalized legal advice, a guilt determination, government approval, or evidence of qualified legal review unless separately documented.
