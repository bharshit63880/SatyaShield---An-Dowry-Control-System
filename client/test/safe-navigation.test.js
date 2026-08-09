import assert from 'node:assert/strict';
import test from 'node:test';

import { safeInternalPath } from '../src/utils/safe-navigation.js';

test('post-auth navigation rejects protocol-relative and external destinations', () => {
  assert.equal(safeInternalPath('//attacker.example/path'), '/dashboard');
  assert.equal(safeInternalPath('https://attacker.example/path'), '/dashboard');
  assert.equal(safeInternalPath('/\\attacker.example'), '/dashboard');
  assert.equal(safeInternalPath('/dashboard?view=mine'), '/dashboard?view=mine');
});
