import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import mongoose from 'mongoose';

import { connectDatabase } from '../src/config/db.js';
import { env } from '../src/config/env.js';
import { uploadsDirectory } from '../src/config/paths.js';
import { Evidence } from '../src/models/evidence.model.js';
import { EvidenceHistory } from '../src/models/evidence-history.model.js';
import { validateEvidenceFile } from '../src/services/evidence-file-validation.service.js';
import { localPrivateStorageProvider } from '../src/services/storage/local-private-storage.provider.js';

const apply = process.argv.includes('--apply');
await connectDatabase();

const legacy = await Evidence.find({
  $or: [
    { evidenceId: { $exists: false } },
    { evidenceId: null },
    { lifecycleStatus: 'legacy_unmigrated' }
  ]
}).select('+fileUrl +fileHash +metadata');

const report = { mode: apply ? 'apply' : 'inventory', total: legacy.length, migratable: 0, missing: 0, invalid: 0 };
for (const record of legacy) {
  const legacyName = path.basename(new URL(record.fileUrl, 'http://legacy.invalid').pathname);
  const candidate = path.resolve(uploadsDirectory, legacyName);
  if (path.dirname(candidate) !== path.resolve(uploadsDirectory)) {
    report.invalid += 1;
    continue;
  }
  let buffer;
  try {
    buffer = await fs.readFile(candidate);
  } catch {
    report.missing += 1;
    if (apply) {
      record.evidenceId = record.evidenceId || crypto.randomUUID();
      record.lifecycleStatus = 'missing';
      await record.save();
      await EvidenceHistory.create({
        evidenceId: record.evidenceId,
        complaintId: record.complaintId,
        event: 'missing_detected',
        actorType: 'migration'
      });
    }
    continue;
  }
  let validated;
  try {
    validated = validateEvidenceFile({
      buffer,
      originalname: record.originalName,
      mimetype: record.mimeType
    }, { maxBytes: env.evidenceMaxFileSize });
  } catch {
    report.invalid += 1;
    continue;
  }
  report.migratable += 1;
  if (!apply) continue;

  const stored = await localPrivateStorageProvider.save(buffer);
  try {
    record.evidenceId = record.evidenceId || crypto.randomUUID();
    record.detectedMimeType = validated.mimeType;
    record.detectedExtension = validated.extension;
    record.plaintextDigest = crypto.createHash('sha256').update(buffer).digest('hex');
    record.encryptedStorageDigest = stored.encryptedDigest;
    record.storageProvider = localPrivateStorageProvider.name;
    record.storageId = stored.storageId;
    record.encryptionVersion = stored.encryptionVersion;
    record.scanStatus = 'pending';
    record.lifecycleStatus = 'pending_scan';
    record.fileUrl = null;
    await record.save();
    await EvidenceHistory.create({
      evidenceId: record.evidenceId,
      complaintId: record.complaintId,
      event: 'uploaded',
      actorType: 'migration',
      details: { source: 'legacy_private_migration' }
    });
  } catch (error) {
    await localPrivateStorageProvider.delete(stored.storageId).catch(() => {});
    throw error;
  }
}

console.log(JSON.stringify(report));
await mongoose.disconnect();
