import crypto from 'crypto';

// Base32 decoding helper
function base32Decode(base32) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = 0;
  let value = 0;
  const output = [];

  for (let i = 0; i < base32.length; i++) {
    const character = base32[i].toUpperCase();
    const idx = alphabet.indexOf(character);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      output.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(output);
}

// Generate base32 secret
export function generateBase32Secret(length = 16) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let secret = '';
  for (let i = 0; i < length; i++) {
    secret += alphabet[crypto.randomInt(0, alphabet.length)];
  }
  return secret;
}

// Generate TOTP for given base32 secret and timestamp
export function generateTOTP(secret, counterOffset = 0, timeStep = 30, now = Date.now()) {
  const counter = Math.floor(now / 1000 / timeStep) + counterOffset;
  return generateTOTPAtStep(secret, counter);
}

// Verify TOTP allowing window offset (for time drift)
export function verifyTOTP(token, secret, window = 1) {
  for (let offset = -window; offset <= window; offset++) {
    if (generateTOTP(secret, offset) === token) {
      return true;
    }
  }
  return false;
}

export function verifyTOTPWithStep(token, secret, { window = 1, now = Date.now() } = {}) {
  const baseStep = Math.floor(now / 1000 / 30);
  for (let offset = -window; offset <= window; offset++) {
    if (generateTOTPAtStep(secret, baseStep + offset) === token) {
      return { valid: true, step: baseStep + offset };
    }
  }
  return { valid: false, step: null };
}

function generateTOTPAtStep(secret, counter) {
  const key = base32Decode(secret);
  const buffer = Buffer.alloc(8);
  buffer.writeBigUInt64BE(BigInt(counter));
  const digest = crypto.createHmac('sha1', key).update(buffer).digest();
  const offset = digest[digest.length - 1] & 0xf;
  const binary = ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff);
  return String(binary % 1000000).padStart(6, '0');
}
