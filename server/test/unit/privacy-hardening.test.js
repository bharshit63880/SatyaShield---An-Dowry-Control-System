import '../helpers/environment.js';
import assert from 'node:assert/strict';
import test from 'node:test';

const { analyzeComplaintRisk } = await import('../../src/services/complaint-risk.service.js');
const { redact, durationBucket, setLogSink, resetLogSink, logEvent } =
  await import('../../src/services/logger.service.js');
const { sanitizeAuditMetadata, safeResourceRef } = await import('../../src/services/audit.service.js');
const { retentionEligibleAt } = await import('../../src/services/retention.service.js');

test('structured logging recursively redacts sensitive keys and buckets timing', () => {
  const entries = [];
  setLogSink((entry) => entries.push(entry));
  logEvent('info', 'privacy_test', {
    authorization: 'Bearer secret',
    nested: { userAgent: 'browser', caseId: 'not-logged', safeCount: 2 }
  });
  resetLogSink();
  assert.equal(entries[0].authorization, '[REDACTED]');
  assert.equal(entries[0].nested.userAgent, '[REDACTED]');
  assert.equal(entries[0].nested.safeCount, 2);
  assert.equal(durationBucket(80), '50_249ms');
});

test('AI provider is not invoked while processing is disabled', async () => {
  let calls = 0;
  const provider = { chat: { completions: { create: async () => { calls += 1; } } } };
  const result = await analyzeComplaintRisk('threat and violence', {
    aiConsent: true,
    aiDisclosureVersion: 'ai-2026-07-v1',
    consentVersion: 'consent-2026-07-v1'
  }, provider);
  assert.equal(calls, 0);
  assert.equal(result.processingMetadata.used, false);
  assert.equal(result.processingMetadata.provider, 'disabled');
});

test('audit metadata is allowlisted and resource references are one-way', () => {
  assert.deepEqual(sanitizeAuditMetadata({
    previousStatus: 'submitted',
    status: 'under-review',
    description: 'must disappear',
    ipAddress: '127.0.0.1'
  }), { stateFrom: 'submitted', stateTo: 'under-review' });
  assert.match(safeResourceRef('anon-private'), /^[a-f0-9]{24}$/);
  assert.equal(safeResourceRef('anon-private').includes('anon-private'), false);
});

test('retention eligibility calculation is deterministic and non-mutating', () => {
  const start = new Date('2026-01-01T00:00:00.000Z');
  assert.equal(retentionEligibleAt(start, 2).toISOString(), '2026-01-03T00:00:00.000Z');
  assert.equal(start.toISOString(), '2026-01-01T00:00:00.000Z');
});
