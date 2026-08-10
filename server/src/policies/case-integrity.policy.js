export const CASE_INTEGRITY_STATUSES = Object.freeze([
  'not_evaluated',
  'normal',
  'duplicate_review',
  'conflicting_information_review',
  'coordinated_abuse_suspected',
  'malicious_abuse_suspected',
  'human_review_completed'
]);

export const CASE_INTEGRITY_SIGNAL_CODES = Object.freeze([
  'exact_narrative_match',
  'exact_evidence_hash_match',
  'structured_answer_conflict',
  'bounded_submission_burst',
  'repeated_target_pattern',
  'quarantined_file_hash_match'
]);

export const CASE_INTEGRITY_DECISION_REASONS = Object.freeze([
  'duplicate_confirmed',
  'duplicate_not_confirmed',
  'conflict_resolved',
  'additional_context_received',
  'coordinated_activity_confirmed',
  'malicious_abuse_confirmed',
  'insufficient_information',
  'reviewer_conflict_recusal',
  'appeal_upheld',
  'appeal_denied',
  'reopened_for_new_information'
]);

export const PROHIBITED_SOLE_ADVERSE_REASONS = Object.freeze([
  'absence_of_evidence',
  'delayed_reporting',
  'inconsistent_trauma_recall',
  'anonymous_submission',
  'unknown_answer',
  'prefer_not_to_say'
]);

export const CASE_INTEGRITY_ACTIONS = Object.freeze({
  QUEUE_READ: 'case-integrity:queue:read',
  ASSESSMENT_READ: 'case-integrity:assessment:read',
  REVIEW_START: 'case-integrity:review:start',
  REVIEW_DECIDE: 'case-integrity:review:decide',
  ADVERSE_CONFIRM: 'case-integrity:adverse:confirm',
  APPEAL_REVIEW: 'case-integrity:appeal:review'
});

const ADMIN_ACTIONS = new Set([
  CASE_INTEGRITY_ACTIONS.QUEUE_READ,
  CASE_INTEGRITY_ACTIONS.ASSESSMENT_READ,
  CASE_INTEGRITY_ACTIONS.REVIEW_START,
  CASE_INTEGRITY_ACTIONS.REVIEW_DECIDE
]);
const SUPERADMIN_ACTIONS = new Set(Object.values(CASE_INTEGRITY_ACTIONS));

export function canPerformCaseIntegrityAction(actor, action) {
  if (!actor || !action) return false;
  if (actor.role === 'superadmin') return SUPERADMIN_ACTIONS.has(action);
  if (actor.role === 'admin') return ADMIN_ACTIONS.has(action);
  return false;
}

export function assertAllowedIntegrityReason(reason) {
  if (!CASE_INTEGRITY_DECISION_REASONS.includes(reason)) {
    throw new Error('Case integrity decision reason is not allowlisted.');
  }
  return reason;
}
