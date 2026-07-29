import crypto from 'crypto';
import mongoose from 'mongoose';
import { env } from '../config/env.js';

const schema = new mongoose.Schema({
  requestId: { type: String, default: () => `triage-request-${crypto.randomUUID()}`, unique: true },
  complaintId: { type: String, required: true, index: true },
  assessmentId: { type: String, required: true },
  requestedByCategory: { type: String, enum: ['ngo', 'investigator'], required: true },
  requestedByRef: { type: String, required: true, select: false },
  reasonCategory: {
    type: String,
    enum: ['new_information', 'incorrect_structured_input', 'danger_changed', 'insufficient_information'],
    required: true
  },
  state: { type: String, enum: ['pending', 'reviewed', 'closed'], default: 'pending' },
  retentionCategory: { type: String, default: 'triage_review_request' },
  retentionPolicyVersion: { type: String, default: () => env.retentionPolicyVersion },
  retentionEligibleAt: { type: Date, required: true },
  legalHold: { type: Boolean, default: false }
}, { timestamps: true });
export const TriageReviewRequest = mongoose.model('TriageReviewRequest', schema);
