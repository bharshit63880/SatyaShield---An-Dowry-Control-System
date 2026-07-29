import path from 'path';

import { ApiError } from '../utils/ApiError.js';

const FORMATS = Object.freeze({
  jpeg: { extension: '.jpg', mimeType: 'image/jpeg', category: 'image' },
  png: { extension: '.png', mimeType: 'image/png', category: 'image' },
  webp: { extension: '.webp', mimeType: 'image/webp', category: 'image' }
});

function reject(code, statusCode = 415) {
  throw new ApiError(statusCode, 'The uploaded file is not a supported evidence format.', { code });
}

export function normalizeEvidenceDisplayName(value = 'evidence') {
  const normalized = value
    .normalize('NFKC')
    .replace(/[\u0000-\u001f\u007f-\u009f]/g, '')
    .replace(/[\\/]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120);
  return normalized || 'evidence';
}

function detectFormat(buffer) {
  if (
    buffer.length >= 4 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[buffer.length - 2] === 0xff &&
    buffer[buffer.length - 1] === 0xd9
  ) return 'jpeg';

  if (
    buffer.length >= 24 &&
    buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) &&
    buffer.subarray(buffer.length - 8, buffer.length - 4).toString('ascii') === 'IEND'
  ) return 'png';

  if (
    buffer.length >= 16 &&
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP' &&
    buffer.readUInt32LE(4) + 8 === buffer.length
  ) return 'webp';

  return null;
}

export function validateEvidenceFile(file, { maxBytes }) {
  if (!file?.buffer?.length) reject('EVIDENCE_EMPTY_FILE', 422);
  if (file.buffer.length > maxBytes) {
    throw new ApiError(413, 'The evidence file exceeds the maximum permitted size.', {
      code: 'EVIDENCE_FILE_TOO_LARGE'
    });
  }

  const inspectionText = file.buffer.subarray(0, Math.min(file.buffer.length, 4096))
    .toString('latin1')
    .toLowerCase();
  if (/<(?:html|script|svg)|javascript:|^mz|^pk\u0003\u0004/.test(inspectionText)) {
    reject('EVIDENCE_SUSPICIOUS_CONTENT', 422);
  }

  const format = detectFormat(file.buffer);
  if (!format) reject('EVIDENCE_SIGNATURE_INVALID');
  const detected = FORMATS[format];
  const displayName = normalizeEvidenceDisplayName(file.originalname);
  const suppliedExtension = path.extname(displayName).toLowerCase();
  const validExtensions = format === 'jpeg' ? new Set(['.jpg', '.jpeg']) : new Set([detected.extension]);
  if (!validExtensions.has(suppliedExtension)) reject('EVIDENCE_EXTENSION_MISMATCH', 422);
  if (file.mimetype && file.mimetype !== detected.mimeType) reject('EVIDENCE_MIME_MISMATCH', 422);

  return {
    ...detected,
    displayName,
    size: file.buffer.length,
    buffer: file.buffer
  };
}
