import assert from 'node:assert/strict';
import test from 'node:test';

import { buildRecoveryCardContent } from '../src/utils/recovery-card.js';

test('recovery card contains both credentials, creation time, and safety instructions', () => {
  const content = buildRecoveryCardContent({
    caseId: 'anon-11111111-1111-4111-8111-111111111111',
    accessSecret: 'test-access-secret-value-with-43-safe-characters',
    createdAt: '2026-07-28T12:00:00.000Z'
  });

  assert.match(content, /SATYASHIELD REPORTER RECOVERY CARD/);
  assert.match(content, /Case ID: anon-/);
  assert.match(content, /Reporter access secret:/);
  assert.match(content, /Created:/);
  assert.match(content, /Do not share/);
  assert.match(content, /cannot automatically recover/);
});
