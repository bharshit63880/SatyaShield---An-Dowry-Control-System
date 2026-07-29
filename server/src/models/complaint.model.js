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
    reporterAccessSecretHash: {
      type: String,
      default: null,
      select: false
    },
    reporterAccessVersion: {
      type: Number,
      default: 0
    },
    reporterAccessEnabled: {
      type: Boolean,
      default: false,
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
    complaintCategory: {
      type: String,
      enum: ['unknown', 'dowry_harassment', 'domestic_violence', 'legal_support', 'safety_planning'],
      default: 'unknown',
      index: true
    },
    preferredLanguage: { type: String, default: null },
    triageInput: {
      dangerHappeningNow: { type: String, default: 'unknown' },
      immediateThreatToLife: { type: String, default: 'unknown' },
      weaponInvolved: { type: String, default: 'unknown' },
      seriousInjuryPresent: { type: String, default: 'unknown' },
      currentlyConfined: { type: String, default: 'unknown' },
      threatEscalating: { type: String, default: 'unknown' },
      stalkingOrRepeatedContact: { type: String, default: 'unknown' },
      vulnerablePersonAtRisk: { type: String, default: 'unknown' },
      urgentMedicalHelpNeeded: { type: String, default: 'unknown' },
      canSafelyContinue: { type: String, default: 'unknown' },
      reporterUrgency: {
        type: String, enum: ['routine', 'concerned', 'urgent', 'unknown', 'prefer_not_to_say'],
        default: 'unknown'
      },
      incidentRecency: {
        type: String, enum: ['happening_now', 'within_24_hours', 'within_week', 'historical', 'unknown', 'prefer_not_to_say'],
        default: 'unknown'
      },
      policyVersion: { type: String, default: null },
      inputSchemaVersion: { type: String, default: null }
    },
    currentTriageAssessmentId: { type: String, default: null, index: true },
    currentTriageVersion: { type: Number, default: 0 },
    currentTriageSeverity: {
      type: String, enum: ['low', 'moderate', 'high', 'critical'], default: null, index: true
    },
    currentTriageReviewState: { type: String, default: null, index: true },
    routingStatus: {
      type: String,
      enum: ['pending_admin_review', 'offer_pending', 'assigned', 'being_reviewed', 'changed', 'completed'],
      default: 'pending_admin_review'
    },
    approximateLocationEncrypted: {
      type: String,
      default: null,
      select: false
    },
    privacyAcknowledged: { type: Boolean, default: false },
    privacyNoticeVersion: { type: String, default: 'legacy-unacknowledged' },
    consentVersion: { type: String, default: 'legacy-unacknowledged' },
    aiConsent: { type: Boolean, default: false },
    aiProcessing: {
      used: { type: Boolean, default: false },
      provider: { type: String, default: 'local-rules' },
      model: { type: String, default: null },
      disclosureVersion: { type: String, default: null },
      consentVersion: { type: String, default: null },
      consentedAt: { type: Date, default: null },
      resultValidationState: { type: String, enum: ['local', 'validated', 'fallback'], default: 'local' }
    },
    detectedKeywords: {
      type: [String],
      default: undefined,
      select: false
    },
    riskScore: {
      type: Number,
      min: 0,
      default: undefined,
      select: false
    },
    riskLevel: {
      type: String,
      enum: COMPLAINT_RISK_LEVELS,
      default: undefined,
      select: false
    },
    indicators: { type: mongoose.Schema.Types.Mixed, default: undefined, select: false },
    escalationRecommendation: {
      type: String,
      default: undefined,
      select: false
    },
    threatSummary: {
      type: String,
      default: undefined,
      select: false
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
      },
      acknowledgedAt: {
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
    },
    retentionCategory: { type: String, default: 'complaint' },
    retentionPolicyVersion: { type: String, default: 'legacy-unclassified' },
    retentionEligibleAt: { type: Date, default: null, index: true },
    deletionRequestedAt: { type: Date, default: null },
    legalHold: { type: Boolean, default: false },
    tombstoneState: {
      type: String,
      enum: ['active', 'deletion_pending', 'deleted'],
      default: 'active'
    },
    deletedAt: { type: Date, default: null }
  },
  {
    timestamps: true
  }
);

// Search indexes
complaintSchema.index({ riskLevel: 1 });
complaintSchema.index({ timestamp: -1 });

export const Complaint = mongoose.model('Complaint', complaintSchema);
