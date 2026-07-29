import '../helpers/environment.js';
import assert from 'node:assert/strict';
import test from 'node:test';

const {
  normalizeEvidenceDisplayName,
  validateEvidenceFile
} = await import('../../src/services/evidence-file-validation.service.js');

const MAX = 1024 * 1024;
const file = (buffer, originalname, mimetype) => ({ buffer, originalname, mimetype });
const validJpeg = Buffer.concat([Buffer.from([0xff, 0xd8]), Buffer.alloc(32, 1), Buffer.from([0xff, 0xd9])]);
const validPng = Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  Buffer.alloc(20),
  Buffer.alloc(4),
  Buffer.from('IEND'),
  Buffer.alloc(4)
]);
const validWebp = Buffer.concat([
  Buffer.from('RIFF'),
  Buffer.from([20, 0, 0, 0]),
  Buffer.from('WEBP'),
  Buffer.alloc(16)
]);

test('signature validator accepts the deliberately supported formats', () => {
  const samples = [
    [validJpeg, 'photo.jpg', 'image/jpeg', 'image/jpeg'],
    [validPng, 'photo.png', 'image/png', 'image/png'],
    [validWebp, 'photo.webp', 'image/webp', 'image/webp']
  ];
  for (const [buffer, name, suppliedMime, expectedMime] of samples) {
    assert.equal(validateEvidenceFile(file(buffer, name, suppliedMime), { maxBytes: MAX }).mimeType, expectedMime);
  }
});

test('signature validator rejects spoofing, mismatches, empty, malformed, and dangerous formats', () => {
  const rejected = [
    file(Buffer.alloc(0), 'empty.png', 'image/png'),
    file(Buffer.from('<html><script>alert(1)</script>'), 'photo.jpg', 'image/jpeg'),
    file(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>'), 'image.svg', 'image/svg+xml'),
    file(Buffer.from('MZ executable'), 'program.exe', 'application/octet-stream'),
    file(Buffer.from('PK\u0003\u0004archive'), 'archive.zip', 'application/zip'),
    file(validJpeg, 'photo.png', 'image/jpeg'),
    file(validJpeg, 'photo.jpg', 'text/html'),
    file(Buffer.from([0xff, 0xd8, 0x00]), 'truncated.jpg', 'image/jpeg')
  ];
  for (const candidate of rejected) {
    assert.throws(() => validateEvidenceFile(candidate, { maxBytes: MAX }));
  }
  assert.throws(
    () => validateEvidenceFile(file(Buffer.alloc(20, 1), 'large.jpg', 'image/jpeg'), { maxBytes: 10 }),
    (error) => error.statusCode === 413
  );
});

test('display filename normalization removes traversal, controls, and excessive length', () => {
  const normalized = normalizeEvidenceDisplayName(`../folder\\\u0000\u0007  proof   name.pdf${'x'.repeat(200)}`);
  assert.equal(normalized.includes('/'), false);
  assert.equal(normalized.includes('\\'), false);
  assert.equal(/[\u0000-\u001f]/.test(normalized), false);
  assert.ok(normalized.length <= 120);
});
