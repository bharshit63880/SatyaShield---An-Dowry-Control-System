import crypto from 'crypto';
import mongoose from 'mongoose';

export const ESCALATION_LEVELS = [
  'none', 'review_due', 'priority_review', 'assignment_attention',
  'senior_review', 'critical_internal_attention'
];
export const ESCALATION_STATES = [
  'created', 'pending', 'acknowledged', 'action_in_progress',
  'resolved', 'cancelled', 'superseded'
];

const transitionSchema = new mongoose.Schema({
  transitionId: { type: String, default: () => `est-${crypto.randomUUID()}` },
  from: { type: String, default: null },
  to: { type: String, enum: ESCALATION_STATES, required: true },
  reasonCategory: { type: String, required: true },
  actorCategory: {
    type: String,
    enum: ['system', 'admin', 'superadmin'],
    required: true
  },
  actorRef: { type: String, default: null, select: false },
  note: { type: String, maxlength: 500, default: null, select: false },
  at: { type: Date, required: true }
}, { _id: false, strict: 'throw' });

const escalationSchema = new mongoose.Schema({
  escalationId: {
    type: String, default: () => `esc-${crypto.randomUUID()}`, unique: true, index: true
  },
  complaintId: { type: String, required: true, index: true },
  level: { type: String, enum: ESCALATION_LEVELS, required: true, index: true },
  triggerCategory: { type: String, required: true, index: true },
  sourceDeadlineId: { type: String, default: null, index: true },
  idempotencyKey: { type: String, required: true, unique: true, index: true },
  policyVersion: { type: String, required: true },
  reasonCodes: { type: [String], default: [] },
  assignedRoleCategory: {
    type: String, enum: ['admin', 'superadmin', 'operations'], default: 'admin'
  },
  status: { type: String, enum: ESCALATION_STATES, default: 'pending', index: true },
  version: { type: Number, default: 1, min: 1 },
  acknowledgedAt: { type: Date, default: null },
  resolvedAt: { type: Date, default: null },
  supersededAt: { type: Date, default: null },
  cancelledAt: { type: Date, default: null },
  resolutionCategory: { type: String, default: null },
  transitions: { type: [transitionSchema], default: [] },
  retentionCategory: { type: String, default: 'workflow_escalation' },
  retentionPolicyVersion: { type: String, required: true },
  retentionEligibleAt: { type: Date, required: true },
  legalHold: { type: Boolean, default: false },

  // Legacy fields remain private for inventory compatibility only.
  reason: { type: String, select: false, default: undefined },
  raisedById: { type: mongoose.Schema.Types.ObjectId, select: false, default: undefined },
  raisedByName: { type: String, select: false, default: undefined },
  raisedByRole: { type: String, select: false, default: undefined },
  notes: { type: String, select: false, default: undefined },
  resolution: { type: String, select: false, default: undefined },
  resolvedById: { type: mongoose.Schema.Types.ObjectId, select: false, default: undefined }
}, { timestamps: true, strict: 'throw' });

escalationSchema.index({ status: 1, level: 1, createdAt: 1 });

export const Escalation = mongoose.model('Escalation', escalationSchema);
