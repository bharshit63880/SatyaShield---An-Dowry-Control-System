import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { promisify } from 'util';
import { ApiError } from '../utils/ApiError.js';

const scrypt = promisify(crypto.scrypt);
const KEY_LENGTH = 64;

export function assertPasswordPolicy(password) {
  const value = String(password ?? '');
  const byteLength = Buffer.byteLength(value, 'utf8');
  if (value.length < 12 || byteLength > 256) {
    throw new ApiError(400, 'Password must be 12 to 256 bytes long.', {
      code: 'AUTH_PASSWORD_POLICY'
    });
  }
  if (/^(password|changeme|adminpass|phase\d|test)/i.test(value)) {
    throw new ApiError(400, 'Choose a non-placeholder password.', {
      code: 'AUTH_PASSWORD_POLICY'
    });
  }
  return value;
}

export async function hashPassword(password) {
  const value = assertPasswordPolicy(password);
  const salt = crypto.randomBytes(16);
  const derived = await scrypt(value, salt, KEY_LENGTH, { N: 16384, r: 8, p: 1 });
  return `scrypt$v1$16384$8$1$${salt.toString('base64url')}$${derived.toString('base64url')}`;
}

export async function verifyPassword(password, encoded) {
  if (encoded?.startsWith('scrypt$')) {
    const [, , n, r, p, saltValue, digestValue] = encoded.split('$');
    const expected = Buffer.from(digestValue, 'base64url');
    const actual = await scrypt(String(password), Buffer.from(saltValue, 'base64url'), expected.length, {
      N: Number(n), r: Number(r), p: Number(p)
    });
    return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
  }
  return bcrypt.compare(String(password), encoded || '');
}

export function passwordNeedsRehash(encoded) {
  return !encoded?.startsWith('scrypt$v1$16384$8$1$');
}

export async function assertPasswordNotReused(password, hashes = []) {
  for (const encoded of hashes.filter(Boolean)) {
    if (await verifyPassword(password, encoded)) {
      throw new ApiError(400, 'Choose a password that has not been used recently.', {
        code: 'AUTH_PASSWORD_REUSED'
      });
    }
  }
}
