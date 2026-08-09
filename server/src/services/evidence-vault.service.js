import crypto from 'crypto';

import { env } from '../config/env.js';
import { Evidence } from '../models/evidence.model.js';
import { EvidenceHistory } from '../models/evidence-history.model.js';
import { ApiError } from '../utils/ApiError.js';
import { validateEvidenceFile } from './evidence-file-validation.service.js';
import { getEvidenceScanner } from './evidence-scanner.service.js';
import { getEvidenceStorageProvider } from './storage/index.js';

function actorFromRequest(req) {
  return {
    actorType: req.user
      ? (['admin', 'superadmin'].includes(req.user.role) ? 'admin' : req.user.role)
      : 'victim',
    actorId: req.user?.id ?? null
  };
}

async function history(evidence, event, actor, details = {}) {
  await EvidenceHistory.create({
    evidenceId: evidence.evidenceId,
    complaintId: evidence.complaintId,
    event,
    actorType: actor.actorType,
    actorId: actor.actorId,
    details
  });
}

export async function createVaultEvidence({
  file,
  complaintId,
  req,
  reporterVisible = true,
  storage = getEvidenceStorageProvider(),
  scanner = getEvidenceScanner(),
  evidenceModel = Evidence
}) {
  const actor = actorFromRequest(req);
  const validated = validateEvidenceFile(file, { maxBytes: env.evidenceMaxFileSize });
  const evidenceId = crypto.randomUUID();
  const plaintextDigest = crypto.createHash('sha256').update(validated.buffer).digest('hex');
  let stored;
  let evidence;

  try {
    stored = await storage.save(validated.buffer);
    evidence = await evidenceModel.create({
      evidenceId,
      complaintId,
      category: validated.category,
      originalName: validated.displayName,
      detectedMimeType: validated.mimeType,
      detectedExtension: validated.extension,
      mimeType: validated.mimeType,
      fileSize: validated.size,
      plaintextDigest,
      encryptedStorageDigest: stored.encryptedDigest,
      storageProvider: storage.name,
      storageId: stored.storageId,
      encryptionVersion: stored.encryptionVersion,
      scanStatus: 'pending',
      lifecycleStatus: 'pending_scan',
      reporterVisible,
      uploadedBy: actor.actorType,
      uploaderId: actor.actorId,
      retentionPolicyVersion: env.retentionPolicyVersion,
      retentionEligibleAt: new Date(Date.now() + env.evidenceRetentionDays * 86400000),
      retentionDeadline: new Date(Date.now() + env.evidenceRetentionDays * 86400000)
    });
  } catch (error) {
    if (stored?.storageId) await storage.delete(stored.storageId).catch(() => {});
    throw error;
  }

  await history(evidence, 'uploaded', actor, {
    detectedMimeType: validated.mimeType,
    fileSize: validated.size
  });
  await history(evidence, 'scan_started', actor);

  let scan;
  try {
    scan = await scanner.scan(validated.buffer);
  } catch {
    scan = { status: 'failed', engine: null, engineVersion: null };
  }

  if (scan.status === 'infected') {
    evidence.scanStatus = 'infected';
    evidence.lifecycleStatus = 'quarantined';
    evidence.quarantinedAt = new Date();
    await evidence.save();
    await storage.quarantine(stored.storageId);
    await history(evidence, 'scan_failed', actor, { result: 'infected' });
    await history(evidence, 'quarantined', actor);
  } else if (scan.status === 'clean') {
    try {
      await storage.makeAvailable(stored.storageId);
    } catch {
      evidence.scanStatus = 'failed';
      evidence.lifecycleStatus = 'pending_scan';
      await evidence.save();
      await history(evidence, 'scan_failed', actor, { result: 'storage_promotion_failed' });
      return evidence;
    }
    evidence.scanStatus = 'clean';
    evidence.lifecycleStatus = 'available';
    evidence.availableAt = new Date();
    evidence.scanEngine = scan.engine ?? null;
    evidence.scanEngineVersion = scan.engineVersion ?? null;
    await evidence.save();
    await history(evidence, 'scan_passed', actor, { engine: scan.engine ?? null });
    await history(evidence, 'made_available', actor);
  } else if (scan.status === 'not_configured' && env.evidenceScannerMode === 'development-bypass') {
    evidence.scanStatus = 'not_configured';
    evidence.lifecycleStatus = 'available';
    evidence.availableAt = new Date();
    await evidence.save();
    await history(evidence, 'made_available', actor, { policy: 'development-bypass' });
  } else {
    evidence.scanStatus = 'failed';
    evidence.lifecycleStatus = 'pending_scan';
    await evidence.save();
    await history(evidence, 'scan_failed', actor, { result: 'scanner_unavailable' });
  }

  return evidence;
}

export async function openVaultEvidence({
  evidence,
  req,
  storage = getEvidenceStorageProvider()
}) {
  if (evidence.lifecycleStatus !== 'available') {
    throw new ApiError(409, 'Evidence is not available for download.', {
      code: 'EVIDENCE_NOT_AVAILABLE'
    });
  }
  if (!evidence.storageId || !(await storage.exists(evidence.storageId))) {
    await Evidence.updateOne(
      { evidenceId: evidence.evidenceId },
      { lifecycleStatus: 'missing' }
    );
    await history(evidence, 'missing_detected', actorFromRequest(req));
    throw new ApiError(404, 'Evidence is unavailable.', { code: 'EVIDENCE_UNAVAILABLE' });
  }
  const plaintext = await storage.open(evidence.storageId);
  const digest = crypto.createHash('sha256').update(plaintext).digest('hex');
  if (digest !== evidence.plaintextDigest) {
    throw new ApiError(409, 'Evidence integrity verification failed.', {
      code: 'EVIDENCE_INTEGRITY_FAILED'
    });
  }
  await history(evidence, 'downloaded', actorFromRequest(req));
  return plaintext;
}

export function safeDownloadFilename(name, extension) {
  const withoutExtension = name.replace(/\.[^.]+$/, '').replace(/["\r\n;]/g, '_').slice(0, 100);
  return `${withoutExtension || 'evidence'}${extension}`;
}

export async function quarantineVaultEvidence(evidence, req, storage = getEvidenceStorageProvider()) {
  if (evidence.storageId) await storage.quarantine(evidence.storageId);
  evidence.lifecycleStatus = 'quarantined';
  evidence.quarantinedAt = new Date();
  await evidence.save();
  await history(evidence, 'quarantined', actorFromRequest(req));
  return evidence;
}

export async function deleteVaultEvidence(evidence, req, storage = getEvidenceStorageProvider()) {
  if (evidence.storageId) await storage.delete(evidence.storageId);
  evidence.lifecycleStatus = 'deleted';
  evidence.deletedAt = new Date();
  evidence.storageId = null;
  await evidence.save();
  await history(evidence, 'deleted', actorFromRequest(req));
  return evidence;
}
