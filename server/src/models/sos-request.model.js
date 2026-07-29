import crypto from 'crypto';
import mongoose from 'mongoose';
import { env } from '../config/env.js';

export const SOS_STATES = [
  'confirmation_pending', 'cancelled', 'created', 'routing_pending',
  'routed_internal', 'delivery_unavailable', 'delivery_failed',
  'acknowledged_by_authorized_staff', 'action_in_progress', 'resolved',
  'expired', 'false_alarm_marked', 'closed'
];
export const ACTIVE_SOS_STATES = [
  'confirmation_pending', 'created', 'routing_pending', 'routed_internal',
  'delivery_unavailable', 'delivery_failed', 'acknowledged_by_authorized_staff',
  'action_in_progress'
];

const transitionSchema = new mongoose.Schema({
  transitionId: { type: String, default: () => `sost-${crypto.randomUUID()}` },
  from: { type: String, default: null },
  to: { type: String, enum: SOS_STATES, required: true },
  outcomeCode: { type: String, required: true },
  actorCategory: {
    type: String,
    enum: ['reporter', 'ngo', 'investigator', 'admin', 'superadmin', 'system'],
    required: true
  },
  actorRef: { type: String, default: null, select: false },
  at: { type: Date, required: true }
}, { _id: false, strict: 'throw' });

const sosSchema = new mongoose.Schema({
  sosId: {
    type: String, default: () => `sos-${crypto.randomUUID()}`, unique: true, index: true
  },
  complaintId: { type: String, required: true },
  reporterScopeRef: { type: String, required: true, select: false },
  idempotencyKey: { type: String, required: true, unique: true, index: true },
  state: { type: String, enum: SOS_STATES, required: true, index: true },
  version: { type: Number, default: 1, min: 1 },
  policyVersion: { type: String, required: true },
  confirmationNoticeVersion: { type: String, required: true },
  cancelUntil: { type: Date, required: true },
  cancelledAt: { type: Date, default: null },
  internalRoutedAt: { type: Date, default: null },
  staffAcknowledgedAt: { type: Date, default: null },
  resolvedAt: { type: Date, default: null },
  expiredAt: { type: Date, default: null },
  activeExpiresAt: { type: Date, required: true },
  locationConsent: { type: Boolean, default: false },
  locationMode: {
    type: String,
    enum: ['none', 'complaint_approximate', 'current_once'],
    default: 'none'
  },
  locationConsentVersion: { type: String, default: null },
  locationEncrypted: { type: String, default: null, select: false },
  locationPrecision: {
    type: String, enum: ['none', 'approximate'], default: 'none'
  },
  safeFailureCode: { type: String, default: null },
  safeOutcomeCode: { type: String, default: null },
  transitions: { type: [transitionSchema], default: [] },
  retentionCategory: { type: String, default: 'sos_safety_request' },
  retentionPolicyVersion: { type: String, default: () => env.retentionPolicyVersion },
  retentionEligibleAt: {
    type: Date,
    default: () => new Date(Date.now() + env.complaintRetentionDays * 86400000)
  },
  legalHold: { type: Boolean, default: false }
}, { timestamps: true, strict: 'throw' });

sosSchema.index(
  { complaintId: 1 },
  {
    unique: true,
    partialFilterExpression: { state: { $in: ACTIVE_SOS_STATES } }
  }
);
sosSchema.index({ state: 1, createdAt: 1 });

export const SosRequest = mongoose.model('SosRequest', sosSchema);
