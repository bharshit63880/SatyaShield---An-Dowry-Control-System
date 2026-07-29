import crypto from 'crypto';
import mongoose from 'mongoose';
import { env } from '../config/env.js';

export const NGO_VERIFICATION_STATES = [
  'draft', 'submitted', 'under_review', 'changes_requested', 'approved',
  'rejected', 'suspended', 'deactivated'
];
export const NGO_REVIEW_REASONS = [
  'incomplete_information', 'unsupported_service_area', 'verification_failed',
  'policy_violation', 'capacity_or_operational_issue', 'duplicate_organization_review',
  'security_concern', 'other_internal_review'
];
export const NGO_CATEGORIES = [
  'dowry_harassment', 'domestic_violence', 'legal_support', 'safety_planning'
];

const coverageSchema = new mongoose.Schema({
  country: { type: String, default: 'in' },
  state: { type: String, default: null },
  district: { type: String, default: null },
  city: { type: String, default: null }
}, { _id: false });

const ngoSchema = new mongoose.Schema(
  {
    publicId: { type: String, default: () => `ngo-${crypto.randomUUID()}`, unique: true, index: true },
    name: { type: String, required: true, trim: true },
    organizationType: {
      type: String,
      enum: ['nonprofit', 'community_group', 'legal_aid', 'support_service', 'other'],
      default: 'nonprofit'
    },
    registrationReference: { type: String, default: null, select: false },
    registrationJurisdiction: { type: String, default: null },
    website: { type: String, default: null },
    publicContact: { type: String, default: null },
    operationalContact: { type: String, default: null, select: false },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    phone: { type: String, default: null, select: false },
    city: { type: String, default: null },
    district: { type: String, default: null },
    description: { type: String, trim: true, maxlength: 1000 },
    supportedCategories: { type: [String], enum: NGO_CATEGORIES, default: [] },
    supportedLanguages: { type: [String], default: [] },
    coverage: { type: [coverageSchema], default: [] },
    remoteSupport: { type: Boolean, default: false },
    serviceHours: {
      timezone: { type: String, default: 'Asia/Kolkata' },
      summary: { type: String, default: null }
    },
    emergencySupportCapability: { type: Boolean, default: false },
    verificationStatus: {
      type: String, enum: NGO_VERIFICATION_STATES, default: 'draft', index: true
    },
    profileVersion: { type: Number, default: 1 },
    approvedProfileVersion: { type: Number, default: null },
    verificationReviewVersion: { type: String, default: null },
    reviewedAt: { type: Date, default: null },
    reviewedByRef: { type: String, default: null, select: false },
    reviewReasonCategory: { type: String, enum: NGO_REVIEW_REASONS, default: null },
    reviewNotes: { type: String, maxlength: 1000, default: null, select: false },
    nextReviewAt: { type: Date, default: null },
    operationalStatus: {
      type: String, enum: ['active', 'inactive', 'suspended', 'deactivated'],
      default: 'inactive', index: true
    },
    acceptsNewAssignments: { type: Boolean, default: false },
    temporaryUnavailableUntil: { type: Date, default: null },
    maximumActiveAssignments: {
      type: Number, min: 1, max: 10000, default: () => env.ngoDefaultMaxActiveCases
    },
    currentActiveAssignments: { type: Number, min: 0, default: 0 },
    capacityVersion: { type: Number, default: 1 },
    lastAssignedAt: { type: Date, default: null },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    retentionCategory: { type: String, default: 'ngo_profile' },
    retentionPolicyVersion: { type: String, default: () => env.retentionPolicyVersion },
    retentionEligibleAt: { type: Date, default: null },
    legalHold: { type: Boolean, default: false },
    // Legacy fields remain inventory-only and never confer eligibility.
    status: { type: String, select: false },
    servedCities: { type: [String], select: false },
    servedDistricts: { type: [String], select: false }
  },
  { timestamps: true }
);

ngoSchema.index({ verificationStatus: 1, operationalStatus: 1, acceptsNewAssignments: 1 });
export const NGO = mongoose.model('NGO', ngoSchema);
