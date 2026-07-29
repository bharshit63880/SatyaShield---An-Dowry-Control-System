import mongoose from 'mongoose';

const evidenceHistorySchema = new mongoose.Schema(
  {
    evidenceId: { type: String, required: true, index: true },
    complaintId: { type: String, required: true, index: true },
    event: {
      type: String,
      enum: [
        'uploaded',
        'validation_failed',
        'scan_started',
        'scan_passed',
        'scan_failed',
        'made_available',
        'downloaded',
        'quarantined',
        'deleted',
        'missing_detected'
      ],
      required: true
    },
    actorType: { type: String, required: true },
    actorId: { type: mongoose.Schema.Types.ObjectId, default: null },
    details: { type: mongoose.Schema.Types.Mixed, default: {} }
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export const EvidenceHistory = mongoose.model('EvidenceHistory', evidenceHistorySchema);
