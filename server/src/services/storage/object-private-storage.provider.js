import crypto from 'crypto';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  PutObjectTaggingCommand,
  S3Client
} from '@aws-sdk/client-s3';

import { env } from '../../config/env.js';
import { ApiError } from '../../utils/ApiError.js';
import { EvidenceStorageProvider } from './evidence-storage.provider.js';

const HEADER = Buffer.from('SSV1');
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

function assertStorageId(storageId) {
  if (!/^[a-f0-9]{64}$/.test(storageId)) {
    throw new ApiError(404, 'Evidence is unavailable.', { code: 'EVIDENCE_UNAVAILABLE' });
  }
}

export class ObjectPrivateStorageProvider extends EvidenceStorageProvider {
  constructor({ client, bucket = env.evidenceObjectBucket, prefix = env.evidenceObjectPrefix,
    keyHex = env.evidenceEncryptionKey } = {}) {
    super();
    this.name = 'object_private';
    this.client = client ?? new S3Client({
      region: env.evidenceObjectRegion,
      endpoint: env.evidenceObjectEndpoint || undefined,
      forcePathStyle: env.evidenceObjectForcePathStyle,
      credentials: env.evidenceObjectAccessKeyId ? {
        accessKeyId: env.evidenceObjectAccessKeyId,
        secretAccessKey: env.evidenceObjectSecretAccessKey
      } : undefined
    });
    this.bucket = bucket;
    this.prefix = prefix.replace(/^\/+|\/+$/g, '');
    this.key = Buffer.from(keyHex, 'hex');
    if (!this.bucket || this.key.length !== 32) throw new Error('Private object storage is not configured.');
  }

  objectKey(storageId) {
    assertStorageId(storageId);
    return this.prefix ? `${this.prefix}/${storageId}` : storageId;
  }

  async save(plaintext) {
    const storageId = crypto.randomBytes(32).toString('hex');
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv('aes-256-gcm', this.key, iv);
    const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    const storedBytes = Buffer.concat([HEADER, iv, cipher.getAuthTag(), ciphertext]);
    await this.client.send(new PutObjectCommand({
      Bucket: this.bucket,
      Key: this.objectKey(storageId),
      Body: storedBytes,
      ContentType: 'application/octet-stream',
      ServerSideEncryption: 'AES256',
      Tagging: 'state=quarantine'
    }));
    return {
      storageId,
      encryptedDigest: crypto.createHash('sha256').update(storedBytes).digest('hex'),
      encryptionVersion: env.evidenceEncryptionVersion
    };
  }

  async open(storageId) {
    try {
      const response = await this.client.send(new GetObjectCommand({
        Bucket: this.bucket, Key: this.objectKey(storageId)
      }));
      const stored = Buffer.from(await response.Body.transformToByteArray());
      if (stored.length < HEADER.length + IV_LENGTH + TAG_LENGTH || !stored.subarray(0, 4).equals(HEADER)) {
        throw new Error('invalid envelope');
      }
      const decipher = crypto.createDecipheriv('aes-256-gcm', this.key, stored.subarray(4, 16));
      decipher.setAuthTag(stored.subarray(16, 32));
      return Buffer.concat([decipher.update(stored.subarray(32)), decipher.final()]);
    } catch (error) {
      if (error?.name === 'NoSuchKey' || error?.$metadata?.httpStatusCode === 404) {
        throw new ApiError(404, 'Evidence is unavailable.', { code: 'EVIDENCE_UNAVAILABLE' });
      }
      throw new ApiError(409, 'Evidence integrity verification failed.', {
        code: 'EVIDENCE_INTEGRITY_FAILED'
      });
    }
  }

  async exists(storageId) {
    try {
      await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: this.objectKey(storageId) }));
      return true;
    } catch (error) {
      if (error?.name === 'NotFound' || error?.$metadata?.httpStatusCode === 404) return false;
      throw error;
    }
  }

  async delete(storageId) {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: this.objectKey(storageId) }));
  }

  async quarantine(storageId) {
    return this.setState(storageId, 'quarantine');
  }

  async makeAvailable(storageId) {
    return this.setState(storageId, 'available');
  }

  async setState(storageId, state) {
    await this.client.send(new PutObjectTaggingCommand({
      Bucket: this.bucket,
      Key: this.objectKey(storageId),
      Tagging: { TagSet: [{ Key: 'state', Value: state }] }
    }));
    return true;
  }

  async metadata(storageId) {
    const response = await this.client.send(new HeadObjectCommand({
      Bucket: this.bucket, Key: this.objectKey(storageId)
    }));
    return { encryptedSize: response.ContentLength };
  }
}
