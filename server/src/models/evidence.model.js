import mongoose from 'mongoose';

const evidenceSchema = new mongoose.Schema(
  {
    complaintId: {
      type: String,
      required: true,
      index: true
    },
    category: {
      type: String,
      enum: ['image', 'video', 'document', 'audio', 'chat_transcript'],
      required: true
    },
    fileUrl: {
      type: String,
      required: true
    },
    originalName: {
      type: String,
      required: true,
      trim: true
    },
    mimeType: {
      type: String,
      required: true
    },
    fileSize: {
      type: Number,
      required: true
    },
    fileHash: {
      type: String,
      required: true,
      index: true
    },
    uploadedBy: {
      type: String,
      enum: ['victim', 'ngo', 'investigator', 'admin'],
      required: true
    },
    uploaderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    isDuplicate: {
      type: Boolean,
      default: false
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    }
  },
  {
    timestamps: true
  }
);

// Compound index to help search evidence per case
evidenceSchema.index({ complaintId: 1, createdAt: -1 });

export const Evidence = mongoose.model('Evidence', evidenceSchema);
