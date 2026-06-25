import mongoose from 'mongoose';

const ngoSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true
    },
    phone: {
      type: String,
      required: true,
      trim: true
    },
    city: {
      type: String,
      required: true,
      trim: true
    },
    district: {
      type: String,
      required: true,
      trim: true
    },
    servedCities: {
      type: [String],
      default: []
    },
    servedDistricts: {
      type: [String],
      default: []
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
      index: true
    },
    description: {
      type: String,
      trim: true
    },
    approvalWorkflow: {
      reviewerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
      },
      notes: {
        type: String,
        default: null
      },
      approvedAt: {
        type: Date,
        default: null
      }
    },
    metrics: {
      casesAssigned: {
        type: Number,
        default: 0
      },
      casesResolved: {
        type: Number,
        default: 0
      },
      averageResolveTimeMs: {
        type: Number,
        default: 0
      }
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true
    }
  },
  {
    timestamps: true
  }
);

export const NGO = mongoose.model('NGO', ngoSchema);
