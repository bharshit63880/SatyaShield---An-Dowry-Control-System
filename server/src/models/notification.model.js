import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['new-complaint', 'status-change'],
      required: true
    },
    title: {
      type: String,
      required: true,
      trim: true
    },
    eventClass: { type: String, enum: ['case-created', 'case-status-changed'], required: true },
    severity: {
      type: String,
      enum: ['info', 'warning', 'critical'],
      default: 'info'
    },
    resourceRef: { type: String, required: true, index: true },
    deliveryState: {
      type: String,
      enum: ['queued', 'skipped_not_configured', 'sent', 'failed'],
      default: 'skipped_not_configured'
    },
    provider: { type: String, default: 'none' },
    isRead: {
      type: Boolean,
      default: false
    }
  },
  {
    timestamps: true
  }
);

export const Notification = mongoose.model('Notification', notificationSchema);
