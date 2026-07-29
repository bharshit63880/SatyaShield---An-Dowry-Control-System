import crypto from 'crypto';
import mongoose from 'mongoose';

export const DEADLINE_TYPES = [
  'triage_review', 'critical_human_review', 'ngo_offer_response',
  'no_eligible_ngo_review', 'reassignment_review', 'unresolved_case_follow_up'
];
export const DEADLINE_STATES = [
  'scheduled', 'due', 'overdue', 'acknowledged', 'resolved',
  'cancelled', 'superseded'
];
export const ACTIVE_DEADLINE_STATES = ['scheduled', 'due', 'overdue'];

const deadlineSchema = new mongoose.Schema({
  deadlineId: {
    type: String, default: () => `ddl-${crypto.randomUUID()}`, unique: true, index: true
  },
  complaintId: { type: String, required: true, index: true },
  deadlineType: { type: String, enum: DEADLINE_TYPES, required: true, index: true },
  policyVersion: { type: String, required: true },
  triggerRef: { type: String, required: true },
  activeKey: { type: String, required: true },
  dueAt: { type: Date, required: true, index: true },
  status: { type: String, enum: DEADLINE_STATES, default: 'scheduled', index: true },
  priority: {
    type: String, enum: ['routine', 'high', 'critical'], default: 'routine', index: true
  },
  attemptCount: { type: Number, default: 0, min: 0 },
  lastEvaluatedAt: { type: Date, default: null },
  nextAttemptAt: { type: Date, default: null, index: true },
  leaseOwner: { type: String, default: null, select: false },
  leaseUntil: { type: Date, default: null, index: true, select: false },
  acknowledgedAt: { type: Date, default: null },
  resolvedAt: { type: Date, default: null },
  cancelledAt: { type: Date, default: null },
  safeOutcomeCode: { type: String, default: null },
  retentionCategory: { type: String, default: 'workflow_deadline' },
  retentionPolicyVersion: { type: String, required: true },
  retentionEligibleAt: { type: Date, required: true },
  legalHold: { type: Boolean, default: false }
}, { timestamps: true, strict: 'throw' });

deadlineSchema.index(
  { activeKey: 1 },
  {
    unique: true,
    partialFilterExpression: { status: { $in: ACTIVE_DEADLINE_STATES } }
  }
);
deadlineSchema.index({ status: 1, dueAt: 1, nextAttemptAt: 1 });

export const WorkflowDeadline = mongoose.model('WorkflowDeadline', deadlineSchema);
