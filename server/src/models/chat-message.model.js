import crypto from 'crypto';
import mongoose from 'mongoose';
import { env } from '../config/env.js';

const chatMessageSchema = new mongoose.Schema({
  messageId: {
    type: String, default: () => `msg-${crypto.randomUUID()}`, unique: true, index: true
  },
  complaintId: { type: String, required: true, index: true },
  sequence: { type: Number, required: true, min: 1 },
  senderActorCategory: {
    type: String,
    enum: ['reporter', 'ngo', 'investigator', 'admin', 'superadmin'],
    required: true
  },
  senderRef: { type: String, required: true },
  clientMessageId: { type: String, required: true },
  messageType: { type: String, enum: ['text', 'attachment', 'text_attachment'], required: true },
  messageEncrypted: { type: String, required: true, select: false },
  attachments: [{
    evidenceId: { type: String, required: true }
  }],
  deliveryState: {
    type: String,
    enum: ['persisted', 'delivered_to_connected_client', 'read'],
    default: 'persisted'
  },
  deliveredAt: { type: Date, default: null },
  readBy: [{
    actorRef: { type: String, required: true },
    actorCategory: { type: String, required: true },
    readAt: { type: Date, required: true }
  }],
  editedAt: { type: Date, default: null },
  tombstonedAt: { type: Date, default: null },
  retentionCategory: { type: String, default: 'case_chat' },
  retentionPolicyVersion: { type: String, default: () => env.retentionPolicyVersion },
  retentionEligibleAt: {
    type: Date,
    default: () => new Date(Date.now() + env.complaintRetentionDays * 86400000)
  },
  legalHold: { type: Boolean, default: false },

  // Legacy sender fields remain private and non-authoritative.
  senderRole: { type: String, select: false, default: undefined },
  senderId: { type: mongoose.Schema.Types.ObjectId, select: false, default: undefined },
  senderName: { type: String, select: false, default: undefined }
}, { timestamps: true, strict: 'throw' });

chatMessageSchema.index({ complaintId: 1, sequence: 1 }, { unique: true });
chatMessageSchema.index(
  { complaintId: 1, senderRef: 1, clientMessageId: 1 },
  { unique: true }
);

const chatSequenceSchema = new mongoose.Schema({
  complaintId: { type: String, required: true, unique: true, index: true },
  nextSequence: { type: Number, default: 0 }
}, { timestamps: false });

export const ChatMessage = mongoose.model('ChatMessage', chatMessageSchema);
export const ChatSequence = mongoose.model('ChatSequence', chatSequenceSchema);
