import { env } from '../config/env.js';
import { Complaint } from '../models/complaint.model.js';
import {
  TriageAssessment, TRIAGE_OVERRIDE_CATEGORIES, TRIAGE_SEVERITIES
} from '../models/triage-assessment.model.js';
import { TriageReviewRequest } from '../models/triage-review-request.model.js';
import { ApiError } from '../utils/ApiError.js';
import { safeResourceRef } from './audit.service.js';
import { evaluateDeterministicTriage } from './complaint-risk.service.js';
import { closeDeadlines, scheduleDeadline } from './escalation-workflow.service.js';

const retentionDate = () => new Date(Date.now() + env.complaintRetentionDays * 86400000);

export async function createInitialTriageAssessment(complaint, input) {
  const result = evaluateDeterministicTriage(input);
  const assessment = await TriageAssessment.create({
    complaintId: complaint.anonymousId, version: 1, ...result,
    source: 'deterministic', aiUsed: false, reviewState: result.reviewState,
    createdByCategory: 'system', retentionEligibleAt: retentionDate()
  });
  const updated = await Complaint.updateOne(
    { _id: complaint._id, currentTriageVersion: 0 },
    {
      currentTriageAssessmentId: assessment.assessmentId,
      currentTriageVersion: 1,
      currentTriageSeverity: assessment.severity,
      currentTriageReviewState: assessment.reviewState,
      triageInput: input
    }
  );
  if (updated.modifiedCount !== 1) {
    await TriageAssessment.deleteOne({ _id: assessment._id });
    throw new ApiError(409, 'Triage assessment already exists.', { code: 'TRIAGE_VERSION_CONFLICT' });
  }
  if (result.reviewState === 'review_required' || ['high', 'critical'].includes(result.severity)) {
    await scheduleDeadline({
      complaintId: complaint.anonymousId,
      type: result.severity === 'critical' ? 'critical_human_review' : 'triage_review',
      severity: result.severity,
      triggerRef: assessment.assessmentId,
      triggeredAt: assessment.createdAt
    });
  }
  return assessment;
}

export function reporterTriageView(assessment) {
  if (!assessment) return {
    severity: 'moderate', meaning: 'Risk could not yet be determined.',
    humanReviewPending: true, nonDispatchNotice: true
  };
  const meanings = {
    low: 'No immediate-danger indicator was identified from the answers provided. This does not mean the situation is safe.',
    moderate: 'The answers indicate a meaningful concern that should be reviewed.',
    high: 'The answers indicate serious or escalating concern requiring prioritized human review.',
    critical: 'The answers indicate possible immediate or imminent severe danger requiring priority human review.'
  };
  return {
    assessmentId: assessment.assessmentId,
    version: assessment.version,
    severity: assessment.severity,
    meaning: meanings[assessment.severity],
    humanReviewPending: ['pending', 'review_required', 'under_review', 'auto_assessed']
      .includes(assessment.reviewState),
    reviewState: assessment.reviewState,
    initialAssessmentNotice: 'This is an initial assessment, not a guarantee or factual determination.',
    safetyGuidance: assessment.severity === 'critical'
      ? 'If you or someone else may be in immediate danger, move to a safer place if you can and contact the appropriate local emergency service or a trusted person. SatyaShield does not automatically contact police, ambulance services or emergency responders.'
      : null,
    nonDispatchNotice: true
  };
}

export function operationalTriageView(assessment, { history = false, privateView = false } = {}) {
  const serialize = (item) => ({
    assessmentId: item.assessmentId, version: item.version, severity: item.severity,
    indicatorCodes: item.indicatorCodes, uncertaintyState: item.uncertaintyState,
    reviewState: item.reviewState, source: item.source,
    triagePolicyVersion: item.triagePolicyVersion,
    inputSchemaVersion: item.inputSchemaVersion,
    criticalRulesetVersion: item.criticalRulesetVersion,
    overrideOccurred: Boolean(item.overrideCategory),
    ...(privateView ? { overrideCategory: item.overrideCategory, internalReviewNote: item.internalReviewNote } : {}),
    createdAt: item.createdAt
  });
  return Array.isArray(assessment) && history ? assessment.map(serialize) : serialize(assessment);
}

export async function getCurrentAssessment(complaintId, { privateView = false } = {}) {
  return TriageAssessment.findOne({ complaintId, isCurrent: true })
    .select(privateView ? '+internalReviewNote +createdByRef' : '').lean();
}

export async function reviewAssessment({
  complaintId, expectedAssessmentId, expectedVersion, severity, action,
  overrideCategory, note, actor
}) {
  if (!['confirm', 'override', 'start_review', 'insufficient'].includes(action)) {
    throw new ApiError(422, 'Review action is invalid.', { code: 'TRIAGE_REVIEW_INVALID' });
  }
  const current = await TriageAssessment.findOne({
    complaintId, assessmentId: expectedAssessmentId, version: Number(expectedVersion), isCurrent: true
  }).select('+internalReviewNote');
  if (!current) throw new ApiError(409, 'Assessment changed. Refresh before reviewing.', {
    code: 'TRIAGE_VERSION_CONFLICT'
  });
  if (action === 'start_review') {
    const result = await TriageAssessment.updateOne(
      { _id: current._id, isCurrent: true, reviewState: { $ne: 'under_review' } },
      { reviewState: 'under_review' }
    );
    if (!result.modifiedCount) throw new ApiError(409, 'Assessment review state changed.', {
      code: 'TRIAGE_VERSION_CONFLICT'
    });
    await closeDeadlines({
      complaintId, triggerRef: current.assessmentId, status: 'acknowledged',
      outcomeCode: 'human_review_started'
    });
    return TriageAssessment.findById(current._id);
  }
  const nextSeverity = action === 'confirm' ? current.severity :
    action === 'insufficient' ? 'moderate' : severity;
  if (!TRIAGE_SEVERITIES.includes(nextSeverity)) throw new ApiError(422, 'Severity is invalid.');
  const downgrade = TRIAGE_SEVERITIES.indexOf(nextSeverity) < TRIAGE_SEVERITIES.indexOf(current.severity);
  if ((action === 'override' || downgrade) &&
      (!TRIAGE_OVERRIDE_CATEGORIES.includes(overrideCategory) || !String(note || '').trim())) {
    throw new ApiError(422, 'A structured reason and review note are required.', {
      code: 'TRIAGE_OVERRIDE_JUSTIFICATION_REQUIRED'
    });
  }
  if (current.severity === 'critical' && downgrade && actor.role !== 'superadmin') {
    throw new ApiError(403, 'Critical downgrades require stronger authorization.', {
      code: 'TRIAGE_CRITICAL_DOWNGRADE_DENIED'
    });
  }
  const claimed = await TriageAssessment.updateOne(
    { _id: current._id, isCurrent: true },
    { isCurrent: false, reviewState: 'superseded' }
  );
  if (!claimed.modifiedCount) throw new ApiError(409, 'Assessment changed. Refresh before reviewing.', {
    code: 'TRIAGE_VERSION_CONFLICT'
  });
  let next;
  try {
    next = await TriageAssessment.create({
      complaintId, version: current.version + 1, severity: nextSeverity,
      indicatorCodes: current.indicatorCodes, uncertaintyState: current.uncertaintyState,
      recommendationCodes: current.recommendationCodes, source: 'human',
      triagePolicyVersion: current.triagePolicyVersion,
      inputSchemaVersion: current.inputSchemaVersion,
      criticalRulesetVersion: current.criticalRulesetVersion,
      reviewState: action === 'confirm' ? 'confirmed' : 'overridden',
      supersedesAssessmentId: current.assessmentId,
      overrideCategory: action === 'confirm' ? null : overrideCategory,
      internalReviewNote: String(note || '').trim().slice(0, 1000) || null,
      createdByCategory: actor.role, createdByRef: safeResourceRef(actor.id),
      confirmedAt: action === 'confirm' ? new Date() : null,
      overriddenAt: action === 'confirm' ? null : new Date(),
      retentionEligibleAt: retentionDate()
    });
    const pointer = await Complaint.updateOne(
      { anonymousId: complaintId, currentTriageAssessmentId: current.assessmentId, currentTriageVersion: current.version },
      {
        currentTriageAssessmentId: next.assessmentId, currentTriageVersion: next.version,
        currentTriageSeverity: next.severity, currentTriageReviewState: next.reviewState
      }
    );
    if (!pointer.modifiedCount) throw new Error('pointer_conflict');
  } catch (error) {
    if (next) await TriageAssessment.deleteOne({ _id: next._id });
    await TriageAssessment.updateOne({ _id: current._id }, {
      isCurrent: true, reviewState: current.reviewState
    });
    throw new ApiError(409, 'Assessment changed. Refresh before reviewing.', {
      code: 'TRIAGE_VERSION_CONFLICT'
    });
  }
  await closeDeadlines({
    complaintId, triggerRef: current.assessmentId, status: 'superseded',
    outcomeCode: 'assessment_superseded'
  });
  return next;
}

export async function requestTriageReview({ complaintId, assessmentId, actor, reasonCategory }) {
  const current = await TriageAssessment.findOne({ complaintId, assessmentId, isCurrent: true }).lean();
  if (!current) throw new ApiError(409, 'Assessment changed.', { code: 'TRIAGE_VERSION_CONFLICT' });
  return TriageReviewRequest.create({
    complaintId, assessmentId, requestedByCategory: actor.role,
    requestedByRef: safeResourceRef(actor.userId), reasonCategory,
    retentionEligibleAt: retentionDate()
  });
}
