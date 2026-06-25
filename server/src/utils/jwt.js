import crypto from 'crypto';
import jwt from 'jsonwebtoken';

import { env } from '../config/env.js';

export function signAccessToken({ subject, role }) {
  return jwt.sign({ role }, env.jwtSecret, {
    algorithm: 'HS256',
    audience: env.jwtAudience,
    expiresIn: '15m', // Short-lived access token
    issuer: env.jwtIssuer,
    jwtid: crypto.randomUUID(),
    subject
  });
}

export function signRefreshToken({ subject, sessionId }) {
  return jwt.sign({ sessionId }, env.jwtSecret, {
    algorithm: 'HS256',
    audience: env.jwtAudience,
    expiresIn: '7d', // 7 days refresh token
    issuer: env.jwtIssuer,
    jwtid: crypto.randomUUID(),
    subject
  });
}

export function verifyAccessToken(token) {
  return jwt.verify(token, env.jwtSecret, {
    algorithms: ['HS256'],
    audience: env.jwtAudience,
    issuer: env.jwtIssuer
  });
}

export function verifyRefreshToken(token) {
  return jwt.verify(token, env.jwtSecret, {
    algorithms: ['HS256'],
    audience: env.jwtAudience,
    issuer: env.jwtIssuer
  });
}
