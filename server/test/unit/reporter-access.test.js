import '../helpers/environment.js';
import assert from 'node:assert/strict';
import test from 'node:test';
import jwt from 'jsonwebtoken';

const {
  generateReporterAccessSecret,
  hashReporterAccessSecret,
  signReporterCaseToken,
  verifyReporterAccessSecret,
  verifyReporterCaseToken
} = await import('../../src/utils/reporter-access.js');
const { env } = await import('../../src/config/env.js');

test('reporter secret is high entropy, hashed, and verifiable', () => {
  const secret = generateReporterAccessSecret();
  const hash = hashReporterAccessSecret(secret);

  assert.ok(secret.length >= 43);
  assert.match(hash, /^[a-f0-9]{64}$/);
  assert.notEqual(hash, secret);
  assert.equal(verifyReporterAccessSecret(secret, hash), true);
  assert.equal(verifyReporterAccessSecret(`${secret}wrong`, hash), false);
});

test('reporter token carries only a complaint-specific scope', () => {
  const caseId = 'anon-11111111-1111-4111-8111-111111111111';
  const token = signReporterCaseToken(caseId);
  const payload = verifyReporterCaseToken(token);

  assert.equal(payload.tokenType, 'reporter_case_access');
  assert.equal(payload.caseId, caseId);
  assert.equal(payload.sub, `case:${caseId}`);
  assert.ok(payload.exp > payload.iat);
  assert.equal(payload.email, undefined);
  assert.equal(payload.role, undefined);
});

test('normal staff token cannot be verified as a reporter token', () => {
  const staffToken = jwt.sign(
    { role: 'admin' },
    env.jwtSecret,
    {
      audience: env.jwtAudience,
      issuer: env.jwtIssuer,
      subject: 'staff-user'
    }
  );

  assert.throws(() => verifyReporterCaseToken(staffToken));
});
