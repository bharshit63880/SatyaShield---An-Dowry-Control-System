import mongoose from 'mongoose';

export const COMPLAINT_STATUSES = ['submitted', 'under-review', 'resolved', 'rejected'];
export const COMPLAINT_RISK_LEVELS = ['low', 'medium', 'high'];

const complaintSchema = new mongoose.Schema(
  {
    anonymousId: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    mediaUrl: {
      type: String,
      default: null
    },
    mediaType: {
      type: String,
      enum: ['image', 'video', 'none'],
      default: 'none'
    },
    descriptionEncrypted: {
      type: String,
      default: null,
      select: false
    },
    locationConsent: {
      type: Boolean,
      default: false
    },
    approximateLocationEncrypted: {
      type: String,
      default: null,
      select: false
    },
    submissionFingerprintHash: {
      type: String,
      default: null,
      select: false,
      index: true
    },
    detectedKeywords: {
      type: [String],
      default: []
    },
    riskScore: {
      type: Number,
      default: 0,
      min: 0
    },
    riskLevel: {
      type: String,
      enum: COMPLAINT_RISK_LEVELS,
      default: 'low'
    },
    indicators: {
      dowryHarassment: { type: Boolean, default: false },
      suicideRisk: { type: Boolean, default: false },
      domesticViolence: { type: Boolean, default: false }
    },
    escalationRecommendation: {
      type: String,
      default: null
    },
    threatSummary: {
      type: String,
      default: null
    },
    assignedNgo: {
      ngoId: {
        type: String,
        default: null
      },
      name: {
        type: String,
        default: null
      },
      city: {
        type: String,
        default: null
      },
      district: {
        type: String,
        default: null
      },
      coverageLabel: {
        type: String,
        default: null
      },
      contactPhone: {
        type: String,
        default: null
      },
      contactEmail: {
        type: String,
        default: null
      },
      assignmentSource: {
        type: String,
        default: null
      },
      matchedOn: {
        type: String,
        default: null
      },
      assignedAt: {
        type: Date,
        default: null
      }
    },
    assignedInvestigator: {
      investigatorId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
      },
      name: {
        type: String,
        default: null
      },
      badgeNumber: {
        type: String,
        default: null
      },
      assignedAt: {
        type: Date,
        default: null
      }
    },
    timestamp: {
      type: Date,
      default: Date.now
    },
    status: {
      type: String,
      enum: COMPLAINT_STATUSES,
      default: 'submitted',
      index: true
    }
  },
  {
    timestamps: true
  }
);

// Search indexes
complaintSchema.index({ riskLevel: 1 });
complaintSchema.index({ timestamp: -1 });

export const Complaint = mongoose.model('Complaint', complaintSchema);
