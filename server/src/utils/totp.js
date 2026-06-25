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
export function generateTOTP(secret, counterOffset = 0, timeStep = 30) {
  const key = base32Decode(secret);
  const epoch = Math.floor(Date.now() / 1000);
  let counter = Math.floor(epoch / timeStep) + counterOffset;

  const buffer = Buffer.alloc(8);
  for (let i = 7; i >= 0; i--) {
    buffer[i] = counter & 0xff;
    counter = counter >> 8;
  }

  const hmac = crypto.createHmac('sha1', key);
  hmac.update(buffer);
  const hmacResult = hmac.digest();

  const offset = hmacResult[hmacResult.length - 1] & 0xf;
  const binary =
    ((hmacResult[offset] & 0x7f) << 24) |
    ((hmacResult[offset + 1] & 0xff) << 16) |
    ((hmacResult[offset + 2] & 0xff) << 8) |
    (hmacResult[offset + 3] & 0xff);

  const otp = binary % 1000000;
  return String(otp).padStart(6, '0');
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
