import mongoose from 'mongoose';

const escalationSchema = new mongoose.Schema(
  {
    complaintId: {
      type: String,
      required: true,
      index: true
    },
    reason: {
      type: String,
      required: true,
      trim: true
    },
    raisedById: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    raisedByName: {
      type: String,
      required: true
    },
    raisedByRole: {
      type: String,
      required: true
    },
    status: {
      type: String,
      enum: ['pending', 'resolved'],
      default: 'pending',
      index: true
    },
    notes: {
      type: String,
      trim: true
    },
    resolution: {
      type: String,
      trim: true
    },
    resolvedById: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    resolvedAt: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true
  }
);

export const Escalation = mongoose.model('Escalation', escalationSchema);
