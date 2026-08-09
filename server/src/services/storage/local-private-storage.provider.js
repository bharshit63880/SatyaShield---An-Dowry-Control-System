import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';

import { env } from '../../config/env.js';
import { privateEvidenceDirectory } from '../../config/paths.js';
import { ApiError } from '../../utils/ApiError.js';
import { EvidenceStorageProvider } from './evidence-storage.provider.js';

const HEADER = Buffer.from('SSV1');
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

export class LocalPrivateStorageProvider extends EvidenceStorageProvider {
  constructor({ rootDirectory = privateEvidenceDirectory, keyHex = env.evidenceEncryptionKey } = {}) {
    super();
    this.name = 'local_private';
    this.rootDirectory = path.resolve(rootDirectory);
    this.key = Buffer.from(keyHex, 'hex');
    if (this.key.length !== 32) throw new Error('Evidence storage encryption key must be 32 bytes.');
  }

  resolve(storageId) {
    if (!/^[a-f0-9]{64}$/.test(storageId)) {
      throw new ApiError(404, 'Evidence is unavailable.', { code: 'EVIDENCE_UNAVAILABLE' });
    }
    const resolved = path.resolve(this.rootDirectory, storageId);
    if (path.dirname(resolved) !== this.rootDirectory) {
      throw new ApiError(404, 'Evidence is unavailable.', { code: 'EVIDENCE_UNAVAILABLE' });
    }
    return resolved;
  }

  async save(plaintext) {
    await fs.mkdir(this.rootDirectory, { recursive: true });
    const storageId = crypto.randomBytes(32).toString('hex');
    const finalPath = this.resolve(storageId);
    const temporaryPath = `${finalPath}.${crypto.randomBytes(8).toString('hex')}.tmp`;
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv('aes-256-gcm', this.key, iv);
    const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    const tag = cipher.getAuthTag();
    const storedBytes = Buffer.concat([HEADER, iv, tag, ciphertext]);
    try {
      await fs.writeFile(temporaryPath, storedBytes, { flag: 'wx', mode: 0o600 });
      await fs.rename(temporaryPath, finalPath);
      return {
        storageId,
        encryptedDigest: crypto.createHash('sha256').update(storedBytes).digest('hex'),
        encryptionVersion: env.evidenceEncryptionVersion
      };
    } catch (error) {
      await fs.rm(temporaryPath, { force: true }).catch(() => {});
      throw error;
    }
  }

  async open(storageId) {
    let stored;
    try {
      stored = await fs.readFile(this.resolve(storageId));
    } catch {
      throw new ApiError(404, 'Evidence is unavailable.', { code: 'EVIDENCE_UNAVAILABLE' });
    }
    if (stored.length < HEADER.length + IV_LENGTH + TAG_LENGTH || !stored.subarray(0, 4).equals(HEADER)) {
      throw new ApiError(409, 'Evidence integrity verification failed.', {
        code: 'EVIDENCE_INTEGRITY_FAILED'
      });
    }
    try {
      const iv = stored.subarray(4, 4 + IV_LENGTH);
      const tag = stored.subarray(4 + IV_LENGTH, 4 + IV_LENGTH + TAG_LENGTH);
      const ciphertext = stored.subarray(4 + IV_LENGTH + TAG_LENGTH);
      const decipher = crypto.createDecipheriv('aes-256-gcm', this.key, iv);
      decipher.setAuthTag(tag);
      return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    } catch {
      throw new ApiError(409, 'Evidence integrity verification failed.', {
        code: 'EVIDENCE_INTEGRITY_FAILED'
      });
    }
  }

  async exists(storageId) {
    try {
      await fs.access(this.resolve(storageId));
      return true;
    } catch {
      return false;
    }
  }

  async delete(storageId) {
    await fs.rm(this.resolve(storageId), { force: true });
  }

  async quarantine(storageId) {
    return this.exists(storageId);
  }

  async makeAvailable(storageId) {
    return this.exists(storageId);
  }

  async metadata(storageId) {
    const stat = await fs.stat(this.resolve(storageId));
    return { encryptedSize: stat.size };
  }
}

export const localPrivateStorageProvider = new LocalPrivateStorageProvider();
