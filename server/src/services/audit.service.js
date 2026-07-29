import crypto from 'crypto';

import { env } from '../config/env.js';
import { AuditLog, AUDIT_ACTIONS } from '../models/audit-log.model.js';
import { logEvent } from './logger.service.js';

const METADATA_KEYS = new Set([
  'stateFrom', 'stateTo', 'contentLength', 'category',
  'policyVersion', 'assessmentSource', 'outcomeCode'
]);

export function safeResourceRef(value) {
  if (!value) return null;
  return crypto.createHash('sha256').update(String(value)).digest('hex').slice(0, 24);
}

export function sanitizeAuditMetadata(details = {}) {
  const source = {
    stateFrom: details.stateFrom ?? details.previousStatus,
    stateTo: details.stateTo ?? details.status,
    contentLength:
      details.contentLength ?? details.noteLength ?? details.reasonLength ?? details.resolutionLength,
    category: details.category ?? null,
    policyVersion: details.policyVersion ?? null,
    assessmentSource: details.assessmentSource ?? null,
    outcomeCode: details.outcomeCode ?? null
  };
  return Object.fromEntries(
    Object.entries(source).filter(([key, value]) =>
      METADATA_KEYS.has(key) && (typeof value === 'string' || typeof value === 'number')
    )
  );
}

export async function createAuditLog({
  userId,
  role,
  action,
  details = {},
  req = null,
  resourceType,
  resourceRef,
  outcome = 'allowed',
  errorCode = null
}) {
  if (!AUDIT_ACTIONS.includes(action)) {
    throw new Error('Audit action is not allowlisted.');
  }
  const actorCategory = role === 'victim' ? 'reporter' : (role || 'guest');
  const inferredRef =
    resourceRef ?? details.anonymousId ?? details.complaintId ?? details.evidenceId ??
    details.sessionId ?? userId;
  const inferredType = resourceType ?? (
    details.evidenceId ? 'evidence'
      : details.anonymousId || details.complaintId ? 'complaint'
        : details.sessionId ? 'session'
          : userId ? 'account' : 'system'
  );
  const createdAt = new Date();
  try {
    return await AuditLog.create({
      actorId: actorCategory === 'reporter' || actorCategory === 'guest' ? null : userId ?? null,
      actorCategory,
      action,
      resourceType: inferredType,
      resourceRef: safeResourceRef(inferredRef),
      outcome,
      errorCode,
      metadata: sanitizeAuditMetadata(details),
      requestId: req?.requestId ?? null,
      retentionCategory: 'security_audit',
      retentionPolicyVersion: env.retentionPolicyVersion,
      retentionEligibleAt: new Date(createdAt.getTime() + env.auditRetentionDays * 86400000)
    });
  } catch {
    logEvent('error', 'audit_write_failed', { action, requestId: req?.requestId });
    return null;
  }
}
