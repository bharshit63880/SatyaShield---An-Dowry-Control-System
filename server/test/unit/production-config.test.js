import '../helpers/environment.js';

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

function validate(overrides) {
  return spawnSync(process.execPath, ['--input-type=module', '--eval', "import('./src/config/env.js')"], {
    cwd: new URL('../..', import.meta.url),
    encoding: 'utf8',
    env: { ...process.env, NODE_ENV: 'production', ...overrides }
  });
}

test('production rejects ephemeral evidence storage', () => {
  const result = validate({
    EVIDENCE_STORAGE_PROVIDER: 'local',
    EVIDENCE_SCANNER_MODE: 'http',
    EVIDENCE_SCANNER_URL: 'https://scanner.example.invalid/scan',
    EVIDENCE_SCANNER_TOKEN: 'test-only-token'
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /durable private object evidence storage/);
});

test('production rejects an unconfigured scanner', () => {
  const result = validate({
    EVIDENCE_STORAGE_PROVIDER: 'object',
    EVIDENCE_OBJECT_BUCKET: 'private-test',
    EVIDENCE_OBJECT_REGION: 'test-region-1',
    EVIDENCE_OBJECT_ACCESS_KEY_ID: 'test-access-key',
    EVIDENCE_OBJECT_SECRET_ACCESS_KEY: 'test-secret-key',
    EVIDENCE_SCANNER_MODE: 'development-bypass'
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /configured evidence scanner adapter/);
});
