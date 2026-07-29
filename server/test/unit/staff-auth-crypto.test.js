import '../helpers/environment.js';
import assert from 'node:assert/strict';
import test from 'node:test';
import jwt from 'jsonwebtoken';

const {
  decryptMfaSecret, digestAuthValue, encryptMfaSecret, randomOpaqueToken
} = await import('../../src/utils/auth-crypto.js');
const { signAccessToken, verifyAccessToken } = await import('../../src/utils/jwt.js');
const { env } = await import('../../src/config/env.js');
const { hashPassword, verifyPassword } = await import('../../src/services/password.service.js');
const { generateTOTP, verifyTOTPWithStep } = await import('../../src/utils/totp.js');

test('purpose digests are deterministic and separated', () => {
  const token = randomOpaqueToken();
  assert.equal(digestAuthValue(token, 'refresh'), digestAuthValue(token, 'refresh'));
  assert.notEqual(digestAuthValue(token, 'refresh'), digestAuthValue(token, 'password_reset'));
  assert.equal(digestAuthValue(token, 'refresh').includes(token), false);
});

test('MFA secret encryption authenticates and round-trips without plaintext storage', () => {
  for (let iteration = 0; iteration < 250; iteration += 1) {
    const encrypted = encryptMfaSecret('JBSWY3DPEHPK3PXP');
    assert.equal(encrypted.includes('JBSWY3DPEHPK3PXP'), false);
    assert.equal(decryptMfaSecret(encrypted), 'JBSWY3DPEHPK3PXP');
    const parts = encrypted.split('.');
    const tag = Buffer.from(parts[2], 'base64url');
    tag[iteration % tag.length] ^= 1;
    parts[2] = tag.toString('base64url');
    assert.throws(() => decryptMfaSecret(parts.join('.')));
  }
});

test('staff access tokens enforce purpose, issuer, audience and account version', () => {
  const token = signAccessToken({
    subject: '507f1f77bcf86cd799439011', role: 'admin',
    sessionId: 'session-safe-id', authVersion: 4
  });
  const claims = verifyAccessToken(token);
  assert.equal(claims.typ, 'staff_access');
  assert.equal(claims.sid, 'session-safe-id');
  assert.equal(claims.ver, 4);
  const wrongPurpose = jwt.sign(
    { role: 'admin', sid: 'session-safe-id', ver: 4, typ: 'reporter_case' },
    env.staffAccessTokenSecret,
    { issuer: env.jwtIssuer, audience: env.jwtAudience, subject: claims.sub }
  );
  assert.throws(() => verifyAccessToken(wrongPurpose));
});

test('TOTP generation and verification support deterministic injected time', () => {
  const now = Date.parse('2026-07-29T07:00:00.000Z');
  const code = generateTOTP('JBSWY3DPEHPK3PXP', 0, 30, now);
  assert.deepEqual(
    verifyTOTPWithStep(code, 'JBSWY3DPEHPK3PXP', { window: 0, now }),
    { valid: true, step: Math.floor(now / 1000 / 30) }
  );
  assert.equal(verifyTOTPWithStep(code, 'JBSWY3DPEHPK3PXP', {
    window: 0, now: now + 30000
  }).valid, false);
});

test('new passwords use versioned scrypt and verify long passphrases', async () => {
  const password = 'A long password-manager passphrase 2026!';
  const encoded = await hashPassword(password);
  assert.match(encoded, /^scrypt\$v1\$/);
  assert.equal(encoded.includes(password), false);
  assert.equal(await verifyPassword(password, encoded), true);
  assert.equal(await verifyPassword(`${password}x`, encoded), false);
});
