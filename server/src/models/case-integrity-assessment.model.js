import crypto from 'crypto';
import mongoose from 'mongoose';

import {
  CASE_INTEGRITY_DECISION_REASONS,
  CASE_INTEGRITY_SIGNAL_CODES,
  CASE_INTEGRITY_STATUSES
} from '../policies/case-integrity.policy.js';

const signalSnapshotSchema = new mongoose.Schema({
  exactNarrativeCandidateCount: { type: Number, min: 0, max: 20, default: 0 },
  duplicateWindowDays: { type: Number, min: 1, max: 365, default: null },
  fingerprintVersion: { type: String, default: null }
}, { _id: false, strict: 'throw' });

const caseIntegrityAssessmentSchema = new mongoose.Schema({
  assessmentId: {
    type: String, default: () => `integrity-${crypto.randomUUID()}`, unique: true, index: true
  },
  complaintId: { type: String, required: true, index: true },
  assessmentVersion: { type: Number, required: true, min: 1 },
  isCurrent: { type: Boolean, default: true },
  status: { type: String, enum: CASE_INTEGRITY_STATUSES, required: true, index: true },
  riskBand: {
    type: String, enum: ['none', 'signal_observed', 'review_required'], required: true
  },
  signalCodes: { type: [String], enum: CASE_INTEGRITY_SIGNAL_CODES, default: [] },
  signalSnapshot: { type: signalSnapshotSchema, default: () => ({}) },
  narrativeFingerprint: { type: String, default: null, select: false },
  modelOrRuleVersion: { type: String, required: true },
  generatedAt: { type: Date, required: true },
  expiresAt: { type: Date, required: true },
  reviewRequired: { type: Boolean, required: true, index: true },
  reviewDeadlineAt: { type: Date, default: null, index: true },
  reviewedBy: { type: String, default: null, select: false },
  reviewedAt: { type: Date, default: null },
  humanDecision: {
    type: String,
    enum: ['no_adverse_finding', 'linked_duplicate', 'inconclusive', 'malicious_abuse_confirmed'],
    default: null
  },
  decisionReasonCodes: { type: [String], enum: CASE_INTEGRITY_DECISION_REASONS, default: [] },
  secondReviewer: { type: String, default: null, select: false },
  appealStatus: {
    type: String, enum: ['not_requested', 'requested', 'under_review', 'upheld', 'denied', 'reopened'],
    default: 'not_requested'
  },
  supersedesAssessmentId: { type: String, default: null },
  retentionPolicyVersion: { type: String, required: true },
  legalHold: { type: Boolean, default: false }
}, { timestamps: { createdAt: true, updatedAt: false }, strict: 'throw' });

caseIntegrityAssessmentSchema.index(
  { complaintId: 1, assessmentVersion: 1 },
  { unique: true }
);
caseIntegrityAssessmentSchema.index(
  { complaintId: 1, isCurrent: 1 },
  { unique: true, partialFilterExpression: { isCurrent: true } }
);
caseIntegrityAssessmentSchema.index(
  { status: 1, reviewRequired: 1, reviewDeadlineAt: 1, generatedAt: 1 },
  { partialFilterExpression: { reviewRequired: true, isCurrent: true } }
);
caseIntegrityAssessmentSchema.index(
  { narrativeFingerprint: 1, generatedAt: -1 },
  { partialFilterExpression: { narrativeFingerprint: { $type: 'string' }, isCurrent: true } }
);

export const CaseIntegrityAssessment = mongoose.model(
  'CaseIntegrityAssessment', caseIntegrityAssessmentSchema
);
