import assert from 'node:assert/strict';
import test from 'node:test';

import { transitionLegalContent } from '../../src/services/legal-content.service.js';

function record(overrides = {}) {
  return {
    state: 'draft', citations: [{ title: 'Source', url: 'https://example.invalid', publisher: 'Fixture' }],
    reviewedAt: null, reviewDueAt: null, async save() {}, ...overrides
  };
}

test('legal information follows review lifecycle and cannot skip approval', async () => {
  const item = record();
  await transitionLegalContent(item, { action: 'submit_review' });
  assert.equal(item.state, 'under_review');
  await transitionLegalContent(item, {
    action: 'approve', reviewerType: 'internal', reviewDueAt: '2030-01-01T00:00:00.000Z'
  }, new Date('2029-01-01T00:00:00.000Z'));
  assert.equal(item.state, 'approved');
  await transitionLegalContent(item, { action: 'publish' }, new Date('2029-01-02T00:00:00.000Z'));
  assert.equal(item.state, 'published');
  await assert.rejects(() => transitionLegalContent(record(), { action: 'publish' }), /not allowed/);
});

test('expired or unreviewed legal information fails closed at publication', async () => {
  const expired = record({
    state: 'approved', reviewedAt: new Date('2025-01-01'), reviewDueAt: new Date('2025-02-01')
  });
  await assert.rejects(
    () => transitionLegalContent(expired, { action: 'publish' }, new Date('2026-01-01')),
    (error) => error.code === 'LEGAL_PUBLICATION_BLOCKED'
  );
});
