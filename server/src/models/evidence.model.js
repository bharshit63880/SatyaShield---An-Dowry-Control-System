import mongoose from 'mongoose';

export const EVIDENCE_LIFECYCLE_STATUSES = [
  'uploading',
  'pending_scan',
  'available',
  'quarantined',
  'rejected',
  'deleted',
  'missing',
  'legacy_unmigrated'
];

const evidenceSchema = new mongoose.Schema(
  {
    evidenceId: { type: String, unique: true, sparse: true, index: true },
    complaintId: { type: String, required: true, index: true },
    category: {
      type: String,
      enum: ['image', 'video', 'document', 'audio', 'chat_transcript'],
      required: true
    },
    originalName: { type: String, required: true, trim: true },
    detectedMimeType: { type: String, default: null },
    detectedExtension: { type: String, default: null },
    mimeType: { type: String, default: null },
    fileSize: { type: Number, required: true },
    plaintextDigest: { type: String, default: null, select: false },
    encryptedStorageDigest: { type: String, default: null, select: false },
    fileHash: { type: String, default: null, select: false },
    storageProvider: { type: String, default: null },
    storageId: { type: String, default: null, select: false },
    encryptionVersion: { type: Number, default: null },
    scanStatus: {
      type: String,
      enum: ['pending', 'not_configured', 'clean', 'infected', 'failed'],
      default: 'pending'
    },
    scanEngine: { type: String, default: null },
    scanEngineVersion: { type: String, default: null },
    lifecycleStatus: {
      type: String,
      enum: EVIDENCE_LIFECYCLE_STATUSES,
      default: 'legacy_unmigrated',
      index: true
    },
    reporterVisible: { type: Boolean, default: true },
    uploadedBy: {
      type: String,
      enum: ['victim', 'ngo', 'investigator', 'admin'],
      required: true
    },
    uploaderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    availableAt: { type: Date, default: null },
    quarantinedAt: { type: Date, default: null },
    deletedAt: { type: Date, default: null },
    retentionDeadline: { type: Date, default: null },
    retentionCategory: { type: String, default: 'evidence' },
    retentionPolicyVersion: { type: String, default: null },
    retentionEligibleAt: { type: Date, default: null, index: true },
    deletionRequestedAt: { type: Date, default: null },
    legalHold: { type: Boolean, default: false },
    tombstoneState: {
      type: String,
      enum: ['active', 'deletion_pending', 'deleted'],
      default: 'active'
    },
    // Legacy-only fields retained for inventory. Never serialize or serve them.
    fileUrl: { type: String, default: null, select: false },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {}, select: false }
  },
  { timestamps: true }
);

evidenceSchema.index({ complaintId: 1, plaintextDigest: 1 });
evidenceSchema.index({ complaintId: 1, createdAt: -1 });

export const Evidence = mongoose.model('Evidence', evidenceSchema);
