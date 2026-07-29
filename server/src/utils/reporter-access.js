import crypto from 'crypto';
import jwt from 'jsonwebtoken';

import { env } from '../config/env.js';

export const REPORTER_TOKEN_TYPE = 'reporter_case_access';

export function generateReporterAccessSecret() {
  return crypto.randomBytes(32).toString('base64url');
}

export function hashReporterAccessSecret(accessSecret) {
  return crypto
    .createHmac('sha256', env.reporterAccessHmacKey)
    .update(String(accessSecret), 'utf8')
    .digest('hex');
}

export function verifyReporterAccessSecret(accessSecret, storedHash) {
  if (typeof storedHash !== 'string' || !/^[a-f0-9]{64}$/i.test(storedHash)) {
    return false;
  }

  const candidate = Buffer.from(hashReporterAccessSecret(accessSecret), 'hex');
  const expected = Buffer.from(storedHash, 'hex');
  return candidate.length === expected.length && crypto.timingSafeEqual(candidate, expected);
}

export function signReporterCaseToken(caseId) {
  return jwt.sign(
    {
      tokenType: REPORTER_TOKEN_TYPE,
      caseId
    },
    env.reporterTokenSecret,
    {
      algorithm: 'HS256',
      audience: env.reporterTokenAudience,
      expiresIn: env.reporterTokenExpiresIn,
      issuer: env.jwtIssuer,
      jwtid: crypto.randomUUID(),
      subject: `case:${caseId}`
    }
  );
}

export function verifyReporterCaseToken(token) {
  const payload = jwt.verify(token, env.reporterTokenSecret, {
    algorithms: ['HS256'],
    audience: env.reporterTokenAudience,
    issuer: env.jwtIssuer
  });

  if (
    payload.tokenType !== REPORTER_TOKEN_TYPE ||
    typeof payload.caseId !== 'string' ||
    payload.sub !== `case:${payload.caseId}`
  ) {
    throw new Error('Invalid reporter token scope.');
  }

  return payload;
}
