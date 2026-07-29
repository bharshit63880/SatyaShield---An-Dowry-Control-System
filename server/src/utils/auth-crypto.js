import crypto from 'crypto';
import { env } from '../config/env.js';

const peppers = {
  refresh: env.refreshTokenPepper,
  email_verification: env.verificationTokenPepper,
  password_reset: env.passwordResetTokenPepper,
  mfa_login: env.mfaChallengeTokenPepper,
  recovery: env.recoveryCodePepper
};

export function randomOpaqueToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString('base64url');
}

export function digestAuthValue(value, purpose) {
  const pepper = peppers[purpose];
  if (!pepper) throw new Error('Unsupported authentication token purpose.');
  return crypto.createHmac('sha256', pepper).update(String(value)).digest('hex');
}

export function timingSafeDigestEqual(left, right) {
  const a = Buffer.from(String(left), 'hex');
  const b = Buffer.from(String(right), 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function encryptMfaSecret(secret) {
  const key = Buffer.from(env.mfaEncryptionKey, 'hex');
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
  return `v1.${iv.toString('base64url')}.${cipher.getAuthTag().toString('base64url')}.${ciphertext.toString('base64url')}`;
}

export function decryptMfaSecret(value) {
  const [version, iv, tag, ciphertext] = String(value).split('.');
  if (version !== 'v1') throw new Error('Unsupported MFA encryption version.');
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    Buffer.from(env.mfaEncryptionKey, 'hex'),
    Buffer.from(iv, 'base64url')
  );
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertext, 'base64url')),
    decipher.final()
  ]).toString('utf8');
}
