import mongoose from 'mongoose';

const caseHistorySchema = new mongoose.Schema(
  {
    complaintId: {
      type: String,
      required: true,
      index: true
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    userName: {
      type: String,
      default: 'System / Anonymous'
    },
    userRole: {
      type: String,
      default: 'visitor'
    },
    action: {
      type: String,
      required: true,
      trim: true
    },
    description: {
      type: String,
      required: true,
      trim: true
    },
    previousStatus: {
      type: String,
      default: null
    },
    newStatus: {
      type: String,
      default: null
    }
  },
  {
    timestamps: { createdAt: true, updatedAt: false }
  }
);

export const CaseHistory = mongoose.model('CaseHistory', caseHistorySchema);
