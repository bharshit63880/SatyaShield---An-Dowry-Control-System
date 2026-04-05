import crypto from 'crypto';

import { env } from '../config/env.js';

const encryptionKey = crypto
  .createHash('sha256')
  .update(env.locationEncryptionKey)
  .digest();

export function encryptSensitiveValue(value) {
  if (!value) {
    return null;
  }

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey, iv);
  const encryptedBuffer = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encryptedBuffer.toString('hex')}`;
}

export function decryptSensitiveValue(payload) {
  if (!payload) {
    return null;
  }

  const [ivHex, authTagHex, encryptedHex] = payload.split(':');

  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    encryptionKey,
    Buffer.from(ivHex, 'hex')
  );

  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));

  const decryptedBuffer = Buffer.concat([
    decipher.update(Buffer.from(encryptedHex, 'hex')),
    decipher.final()
  ]);

  return decryptedBuffer.toString('utf8');
}
