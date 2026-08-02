import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import test from 'node:test';

import {
  createFakeNotificationAdapter,
  renderNotificationTemplate,
  verifyProviderWebhook
} from '../../src/services/notification.service.js';

test('notification templates are versioned, bilingual and strictly allowlisted', () => {
  const english = renderNotificationTemplate({
    templateKey: 'case.status_changed', language: 'en', variables: { statusLabel: 'Under review' }
  });
  const hindi = renderNotificationTemplate({
    templateKey: 'case.status_changed', language: 'hi', variables: { statusLabel: 'समीक्षा में' }
  });
  assert.equal(english.version, 1);
  assert.match(english.text, /Under review/);
  assert.match(hindi.text, /समीक्षा में/);
  assert.throws(() => renderNotificationTemplate({
    templateKey: 'case.created', variables: { complaintNarrative: 'private' }
  }), /allowlist/);
});

test('deterministic fake provider records bounded payloads without real delivery', async () => {
  const adapter = createFakeNotificationAdapter();
  const result = await adapter.deliver({ recipient: 'test@example.invalid', subject: 'Test', text: 'Static test' });
  assert.equal(result.accepted, true);
  assert.equal(adapter.calls.length, 1);
});

test('signed webhook validation rejects tampering, stale timestamps and replay', () => {
  const secret = 'w'.repeat(64);
  const rawBody = '{"state":"delivered"}';
  const timestamp = 2_000_000;
  const nonce = 'nonce-1';
  const signature = crypto.createHmac('sha256', secret)
    .update(`${timestamp}.${nonce}.${rawBody}`).digest('hex');
  const seen = new Set();
  assert.equal(verifyProviderWebhook({ rawBody, signature, timestamp, nonce, secret, seenNonces: seen, now: timestamp }), true);
  assert.equal(verifyProviderWebhook({ rawBody, signature, timestamp, nonce, secret, seenNonces: seen, now: timestamp }), false);
  assert.equal(verifyProviderWebhook({ rawBody: `${rawBody}x`, signature, timestamp, nonce: 'nonce-2', secret, seenNonces: seen, now: timestamp }), false);
  assert.equal(verifyProviderWebhook({ rawBody, signature, timestamp, nonce: 'nonce-3', secret, seenNonces: seen, now: timestamp + 600_000 }), false);
});
