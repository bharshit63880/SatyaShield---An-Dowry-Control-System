import { Complaint } from '../models/complaint.model.js';
import { Evidence } from '../models/evidence.model.js';
import { AuditLog } from '../models/audit-log.model.js';
import { env } from '../config/env.js';

export function retentionEligibleAt(from, days) {
  return new Date(new Date(from).getTime() + days * 86400000);
}

export async function buildRetentionDryRunReport(now = new Date()) {
  const active = { legalHold: { $ne: true }, tombstoneState: { $ne: 'deleted' } };
  const [complaints, evidence, auditLogs] = await Promise.all([
    Complaint.countDocuments({ ...active, retentionEligibleAt: { $lte: now } }),
    Evidence.countDocuments({ ...active, retentionEligibleAt: { $lte: now } }),
    AuditLog.countDocuments({ legalHold: { $ne: true }, deletedAt: null, retentionEligibleAt: { $lte: now } })
  ]);
  return {
    mode: 'dry-run',
    enforcementEnabled: env.retentionEnforcementEnabled,
    policyVersion: env.retentionPolicyVersion,
    evaluatedAt: now,
    eligible: { complaints, evidence, auditLogs },
    mutationsPerformed: 0
  };
}
