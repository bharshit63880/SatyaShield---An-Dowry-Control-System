import mongoose from 'mongoose';

const auditLogSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true
    },
    userEmail: {
      type: String,
      default: 'anonymous',
      index: true
    },
    role: {
      type: String,
      default: 'guest'
    },
    action: {
      type: String,
      required: true,
      enum: [
        'login',
        'logout',
        'login_failure',
        'mfa_enabled',
        'mfa_verified',
        'password_reset_request',
        'password_reset_success',
        'case_view',
        'case_edit',
        'status_change',
        'assignment_change',
        'evidence_upload',
        'chat_message_sent',
        'admin_action',
        'escalation_raised',
        'escalation_resolved',
        'api_request'
      ],
      index: true
    },
    details: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    ipAddress: {
      type: String,
      default: 'unknown'
    },
    userAgent: {
      type: String,
      default: 'unknown'
    }
  },
  {
    timestamps: { createdAt: true, updatedAt: false }
  }
);

export const AuditLog = mongoose.model('AuditLog', auditLogSchema);
