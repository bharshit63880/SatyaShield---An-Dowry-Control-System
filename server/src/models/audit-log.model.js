import mongoose from 'mongoose';

export const AUDIT_ACTIONS = [
  'login', 'logout', 'login_failure', 'mfa_enabled', 'mfa_verified',
  'password_reset_request', 'password_reset_success', 'case_view', 'case_edit',
  'status_change', 'assignment_change', 'assignment_acknowledged', 'evidence_upload',
  'chat_message_sent', 'admin_action', 'escalation_raised', 'escalation_resolved',
  'authorization_denied', 'retention_report', 'investigation_note', 'status_update',
  'complaint_created', 'investigator_assigned', 'escalated', 'ngo_assigned',
  'login_succeeded', 'mfa_challenge_created', 'mfa_succeeded', 'recovery_code_used',
  'refresh_rotated', 'refresh_reuse_detected', 'session_revoked', 'password_changed',
  'password_reset_completed', 'email_verified', 'account_disabled',
  'verification_challenge_created', 'bootstrap_admin_created'
  ,'recovery_codes_regenerated', 'mfa_disabled'
  ,'ngo_profile_updated', 'ngo_profile_submitted', 'ngo_review_transition',
  'assignment_offered', 'assignment_rejected', 'assignment_withdrawn', 'assignment_reassigned'
  ,'triage_assessed', 'triage_marked_critical', 'triage_review_required',
  'triage_review_started', 'triage_confirmed', 'triage_overridden',
  'triage_downgraded', 'triage_review_requested', 'ai_triage_skipped',
  'ai_triage_blocked', 'ai_advisory_validated_test_only', 'ai_advisory_rejected_test_only'
  ,'deadline_scheduled', 'deadline_escalated', 'deadline_cancelled',
  'scheduler_dry_run', 'scheduler_manual_run',
  'escalation_acknowledge', 'escalation_start_action', 'escalation_resolve',
  'escalation_cancel', 'escalation_reopen'
  ,'socket_authenticated', 'socket_auth_failed', 'room_join_allowed',
  'room_join_denied', 'socket_access_revoked', 'message_persisted',
  'attachment_reference_rejected', 'message_rate_limited'
  ,'sos_confirmation_started', 'sos_cancelled', 'sos_created',
  'sos_duplicate_prevented', 'sos_internal_routed',
  'sos_delivery_unavailable', 'sos_acknowledged',
  'sos_action_in_progress', 'sos_resolved', 'sos_expired',
  'sos_false_alarm_marked', 'sos_closed',
  'sos_location_consent_recorded', 'sos_location_accessed',
  'sos_access_denied', 'helpline_entry_reviewed',
  'helpline_entry_deactivated'
];

const auditLogSchema = new mongoose.Schema(
  {
    actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    actorCategory: {
      type: String,
      enum: ['reporter', 'admin', 'superadmin', 'ngo', 'investigator', 'user', 'system', 'guest'],
      required: true,
      index: true
    },
    action: { type: String, enum: AUDIT_ACTIONS, required: true, index: true },
    resourceType: { type: String, enum: ['complaint', 'evidence', 'session', 'account', 'system'], required: true },
    resourceRef: { type: String, default: null },
    outcome: { type: String, enum: ['allowed', 'denied', 'failed'], required: true },
    errorCode: { type: String, default: null },
    metadata: {
      stateFrom: { type: String, default: null },
      stateTo: { type: String, default: null },
      contentLength: { type: Number, default: null },
      category: { type: String, default: null }
      ,policyVersion: { type: String, default: null },
      assessmentSource: { type: String, default: null },
      outcomeCode: { type: String, default: null }
    },
    requestId: { type: String, default: null },
    retentionCategory: { type: String, default: 'security_audit' },
    retentionPolicyVersion: { type: String, required: true },
    retentionEligibleAt: { type: Date, required: true },
    legalHold: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null }
  },
  { timestamps: { createdAt: true, updatedAt: false }, strict: 'throw' }
);

export const AuditLog = mongoose.model('AuditLog', auditLogSchema);
