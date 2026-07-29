import crypto from 'crypto';
import mongoose from 'mongoose';

export const ASSIGNMENT_STATES = [
  'offered', 'acknowledged', 'active', 'rejected', 'expired',
  'withdrawn', 'reassigned', 'completed'
];

const ngoAssignmentSchema = new mongoose.Schema(
  {
    assignmentId: {
      type: String, default: () => `asgn-${crypto.randomUUID()}`, unique: true, index: true
    },
    complaintId: { type: String, required: true, index: true },
    ngoPublicId: { type: String, required: true, index: true },
    state: { type: String, enum: ASSIGNMENT_STATES, required: true, index: true },
    isCurrent: { type: Boolean, default: true },
    source: { type: String, enum: ['manual', 'routing_recommendation'], required: true },
    routingPolicyVersion: { type: String, required: true },
    recommendationReasonCodes: { type: [String], default: [] },
    assignedByRef: { type: String, default: null },
    reasonCategory: { type: String, default: null },
    offeredAt: { type: Date, default: null },
    acknowledgedAt: { type: Date, default: null },
    activatedAt: { type: Date, default: null },
    rejectedAt: { type: Date, default: null },
    expiredAt: { type: Date, default: null },
    expiresAt: { type: Date, default: null, index: true },
    withdrawnAt: { type: Date, default: null },
    completedAt: { type: Date, default: null }
  },
  { timestamps: true }
);

ngoAssignmentSchema.index(
  { complaintId: 1, isCurrent: 1 },
  { unique: true, partialFilterExpression: { isCurrent: true } }
);
export const NgoAssignment = mongoose.model('NgoAssignment', ngoAssignmentSchema);
