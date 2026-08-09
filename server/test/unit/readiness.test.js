import '../helpers/environment.js';
import assert from 'node:assert/strict';
import test from 'node:test';

const { buildReadinessSnapshot } = await import('../../src/services/readiness.service.js');

test('readiness fails closed when any required dependency is unavailable', () => {
  assert.deepEqual(buildReadinessSnapshot({ database: true, storage: false }), {
    ready: false,
    checks: { database: true, storage: false }
  });
  assert.equal(buildReadinessSnapshot({ database: true, storage: true }).ready, true);
});
