import crypto from 'crypto';
import mongoose from 'mongoose';
import { env } from '../config/env.js';

const helplineSchema = new mongoose.Schema({
  helplineId: {
    type: String, default: () => `help-${crypto.randomUUID()}`, unique: true, index: true
  },
  directoryVersion: { type: String, required: true, index: true },
  country: { type: String, required: true, lowercase: true, index: true },
  region: { type: String, default: null, index: true },
  serviceCategory: {
    type: String,
    enum: ['emergency', 'domestic_violence', 'legal_aid', 'medical', 'counselling', 'other'],
    required: true,
    index: true
  },
  displayName: { type: String, required: true, maxlength: 160 },
  contactMethod: { type: String, enum: ['phone', 'sms', 'website'], required: true },
  contactValue: { type: String, required: true, maxlength: 300 },
  availabilityWording: { type: String, required: true, maxlength: 300 },
  languages: { type: [String], default: [] },
  sourceAuthority: { type: String, required: true, maxlength: 200 },
  sourceReference: { type: String, required: true, maxlength: 500, select: false },
  sourceVerifiedAt: { type: Date, required: true },
  lastReviewedAt: { type: Date, required: true },
  reviewStatus: {
    type: String,
    enum: ['draft', 'under_review', 'verified', 'expired', 'rejected'],
    default: 'draft',
    index: true
  },
  reverifyAt: { type: Date, required: true, index: true },
  active: { type: Boolean, default: false, index: true },
  geographicApplicability: { type: String, required: true, maxlength: 300 },
  safeDisclaimer: { type: String, required: true, maxlength: 500 },
  reviewVersion: { type: Number, default: 1, min: 1 },
  reviewedByRef: { type: String, default: null, select: false },
  testFixture: { type: Boolean, default: false, select: false },
  retentionCategory: { type: String, default: 'helpline_directory' },
  retentionPolicyVersion: { type: String, default: () => env.retentionPolicyVersion },
  legalHold: { type: Boolean, default: false }
}, { timestamps: true, strict: 'throw' });

helplineSchema.index({
  directoryVersion: 1, country: 1, serviceCategory: 1, reviewStatus: 1,
  active: 1, reverifyAt: 1
});

export const HelplineEntry = mongoose.model('HelplineEntry', helplineSchema);
