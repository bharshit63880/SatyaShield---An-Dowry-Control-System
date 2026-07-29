import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

export function signAccessToken({ subject, role, sessionId = crypto.randomUUID(), authVersion = 1 }) {
  return jwt.sign(
    { role, sid: sessionId, ver: authVersion, typ: 'staff_access' },
    env.staffAccessTokenSecret,
    {
      algorithm: 'HS256',
      audience: env.jwtAudience,
      expiresIn: env.staffAccessTokenExpiresIn,
      issuer: env.jwtIssuer,
      jwtid: crypto.randomUUID(),
      subject,
      keyid: env.staffTokenKeyId
    }
  );
}

export function verifyAccessToken(token) {
  const verified = jwt.verify(token, env.staffAccessTokenSecret, {
    algorithms: ['HS256'],
    audience: env.jwtAudience,
    issuer: env.jwtIssuer,
    complete: true
  });
  const decoded = verified.payload;
  if (
    verified.header.kid !== env.staffTokenKeyId ||
    decoded.typ !== 'staff_access' ||
    typeof decoded.sub !== 'string' ||
    typeof decoded.role !== 'string' ||
    typeof decoded.sid !== 'string' ||
    !Number.isInteger(decoded.ver)
  ) throw new Error('Invalid staff access claims.');
  return decoded;
}

// Removed in Phase 5. Refresh credentials are opaque, rotated, and hashed.
export function signRefreshToken() {
  throw new Error('JWT refresh tokens are not supported.');
}

export function verifyRefreshToken() {
  throw new Error('JWT refresh tokens are not supported.');
}
