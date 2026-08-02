import mongoose from 'mongoose';

export const NOTIFICATION_STATES = [
  'created', 'queued', 'processing', 'provider_accepted', 'delivered', 'failed',
  'retry_scheduled', 'skipped_not_configured', 'suppressed', 'permanently_failed'
];

const attemptSchema = new mongoose.Schema({
  number: { type: Number, required: true },
  state: { type: String, enum: NOTIFICATION_STATES, required: true },
  failureCategory: { type: String, default: '' },
  providerReferenceDigest: { type: String, default: '' },
  attemptedAt: { type: Date, required: true }
}, { _id: false });

const notificationSchema = new mongoose.Schema({
  type: { type: String, required: true, trim: true },
  title: { type: String, required: true, trim: true },
  eventClass: { type: String, required: true, trim: true },
  severity: { type: String, enum: ['info', 'warning', 'critical'], default: 'info' },
  resourceRef: { type: String, required: true, index: true },
  recipientRef: { type: String, required: true },
  channel: { type: String, enum: ['email', 'sms', 'push', 'none'], default: 'none' },
  language: { type: String, enum: ['en', 'hi'], default: 'en' },
  templateKey: { type: String, required: true },
  templateVersion: { type: Number, required: true, min: 1 },
  templateVariables: { type: Map, of: String, default: {} },
  state: { type: String, enum: NOTIFICATION_STATES, default: 'created', index: true },
  deliveryState: { type: String, enum: NOTIFICATION_STATES, default: 'created' },
  provider: { type: String, default: 'none' },
  idempotencyKey: { type: String, required: true, unique: true },
  attemptCount: { type: Number, default: 0 },
  maxAttempts: { type: Number, default: 4 },
  nextAttemptAt: { type: Date, default: null },
  deliveredAt: { type: Date, default: null },
  attempts: { type: [attemptSchema], default: [] },
  isRead: { type: Boolean, default: false }
}, { timestamps: true });

notificationSchema.index({ state: 1, nextAttemptAt: 1 });

export const Notification = mongoose.model('Notification', notificationSchema);
