import crypto from 'crypto';
import mongoose from 'mongoose';
import { env } from '../config/env.js';

export const TRIAGE_SEVERITIES = ['low', 'moderate', 'high', 'critical'];
export const TRIAGE_REVIEW_STATES = [
  'pending', 'auto_assessed', 'review_required', 'under_review',
  'confirmed', 'overridden', 'superseded'
];
export const TRIAGE_OVERRIDE_CATEGORIES = [
  'new_information', 'reporter_clarification', 'incorrect_structured_input',
  'policy_misclassification', 'duplicate_or_conflicting_information',
  'verified_immediate_danger', 'danger_no_longer_current',
  'insufficient_information', 'other_reviewed_reason'
];

const triageAssessmentSchema = new mongoose.Schema({
  assessmentId: {
    type: String, default: () => `triage-${crypto.randomUUID()}`, unique: true, index: true
  },
  complaintId: { type: String, required: true, index: true },
  version: { type: Number, required: true, min: 1 },
  isCurrent: { type: Boolean, default: true },
  severity: { type: String, enum: TRIAGE_SEVERITIES, required: true, index: true },
  indicatorCodes: { type: [String], default: [] },
  uncertaintyState: {
    type: String, enum: ['none', 'incomplete', 'conflicting', 'invalid'], required: true
  },
  recommendationCodes: { type: [String], default: [] },
  source: { type: String, enum: ['deterministic', 'human', 'ai_advisory_test_only'], required: true },
  triagePolicyVersion: { type: String, required: true },
  inputSchemaVersion: { type: String, required: true },
  criticalRulesetVersion: { type: String, required: true },
  aiUsed: { type: Boolean, default: false },
  aiProvider: { type: String, default: null },
  aiModel: { type: String, default: null },
  aiPolicyVersion: { type: String, default: null },
  aiDisclosureVersion: { type: String, default: null },
  consentVersion: { type: String, default: null },
  consentedAt: { type: Date, default: null },
  reviewState: { type: String, enum: TRIAGE_REVIEW_STATES, required: true, index: true },
  supersedesAssessmentId: { type: String, default: null },
  overrideCategory: { type: String, enum: TRIAGE_OVERRIDE_CATEGORIES, default: null },
  internalReviewNote: { type: String, maxlength: 1000, default: null, select: false },
  createdByCategory: {
    type: String, enum: ['system', 'admin', 'superadmin', 'investigator'], required: true
  },
  createdByRef: { type: String, default: null, select: false },
  confirmedAt: { type: Date, default: null },
  overriddenAt: { type: Date, default: null },
  retentionCategory: { type: String, default: 'triage_assessment' },
  retentionPolicyVersion: { type: String, default: () => env.retentionPolicyVersion },
  retentionEligibleAt: { type: Date, required: true },
  legalHold: { type: Boolean, default: false }
}, { timestamps: { createdAt: true, updatedAt: false } });

triageAssessmentSchema.index({ complaintId: 1, version: 1 }, { unique: true });
triageAssessmentSchema.index(
  { complaintId: 1, isCurrent: 1 },
  { unique: true, partialFilterExpression: { isCurrent: true } }
);
triageAssessmentSchema.index({ isCurrent: 1, severity: 1, reviewState: 1, createdAt: 1 });
export const TriageAssessment = mongoose.model('TriageAssessment', triageAssessmentSchema);
