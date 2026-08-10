import crypto from 'crypto';
import mongoose from 'mongoose';

const caseLinkSchema = new mongoose.Schema({
  linkId: { type: String, default: () => `case-link-${crypto.randomUUID()}`, unique: true },
  sourceComplaintId: { type: String, required: true, index: true },
  candidateComplaintId: { type: String, required: true, index: true },
  linkType: { type: String, enum: ['exact_narrative'], required: true },
  similarityReason: { type: String, enum: ['normalized_hmac_match'], required: true },
  confidenceBand: { type: String, enum: ['exact', 'high', 'possible'], required: true },
  humanConfirmation: {
    type: String, enum: ['pending', 'confirmed', 'rejected'], default: 'pending'
  },
  createdByCategory: { type: String, enum: ['system', 'reviewer'], required: true },
  createdByRef: { type: String, default: null, select: false },
  status: { type: String, enum: ['active', 'reversed'], default: 'active' },
  reversedAt: { type: Date, default: null },
  reversalReasonCode: { type: String, default: null },
  policyVersion: { type: String, required: true },
  legalHold: { type: Boolean, default: false }
}, { timestamps: true, strict: 'throw' });

caseLinkSchema.index(
  { sourceComplaintId: 1, candidateComplaintId: 1, linkType: 1 },
  { unique: true }
);
caseLinkSchema.index({ status: 1, createdAt: -1 });

export const CaseLink = mongoose.model('CaseLink', caseLinkSchema);
