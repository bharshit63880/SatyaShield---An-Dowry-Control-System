import { Complaint } from '../models/complaint.model.js';
import { TriageAssessment, TRIAGE_SEVERITIES } from '../models/triage-assessment.model.js';
import { Escalation } from '../models/escalation.model.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import { sendCreated, sendSuccess } from '../utils/apiResponse.js';
import { createAuditLog } from '../services/audit.service.js';
import {
  getCurrentAssessment, operationalTriageView, reporterTriageView,
  requestTriageReview, reviewAssessment
} from '../services/triage.service.js';
import { reporterWorkflowStatus } from '../services/escalation-workflow.service.js';

export const getTriage = asyncHandler(async (req, res) => {
  const assessment = await getCurrentAssessment(req.params.anonymousId);
  if (!assessment) throw new ApiError(404, 'Triage assessment is unavailable.', {
    code: 'TRIAGE_UNAVAILABLE'
  });
  const reporter = Boolean(req.reporterCaseAccess);
  const activeEscalation = reporter ? await Escalation.findOne({
    complaintId: req.params.anonymousId,
    status: { $in: ['created', 'pending', 'acknowledged', 'action_in_progress'] }
  }).sort({ createdAt: -1 }).lean() : null;
  return sendSuccess(res, { message: 'Triage status fetched.', data: {
    triage: reporter ? {
      ...reporterTriageView(assessment),
      workflowStatus: reporterWorkflowStatus(activeEscalation),
      workflowNotice: 'This is an internal workflow status, not a guaranteed response time or dispatch confirmation.'
    } : operationalTriageView(assessment)
  } });
});

export const createReviewRequest = asyncHandler(async (req, res) => {
  if (!['ngo', 'investigator'].includes(req.staffActor?.role)) {
    throw new ApiError(403, 'Review request is unavailable.', { code: 'RESOURCE_ACCESS_DENIED' });
  }
  if (!['new_information', 'incorrect_structured_input', 'danger_changed', 'insufficient_information']
    .includes(req.body.reasonCategory)) {
    throw new ApiError(422, 'Review request reason is invalid.', { code: 'TRIAGE_REVIEW_INVALID' });
  }
  const request = await requestTriageReview({
    complaintId: req.params.anonymousId, assessmentId: req.body.assessmentId,
    actor: req.staffActor, reasonCategory: req.body.reasonCategory
  });
  await createAuditLog({ userId: req.user.id, role: req.user.role, action: 'triage_review_requested',
    resourceType: 'complaint', resourceRef: req.params.anonymousId,
    details: { category: req.body.reasonCategory }, req });
  return sendCreated(res, { message: 'Triage review requested.', data: {
    request: { requestId: request.requestId, state: request.state }
  } });
});

export const triageQueue = asyncHandler(async (req, res) => {
  const page = Math.max(1, Math.min(10000, Number(req.query.page) || 1));
  const limit = Math.max(1, Math.min(50, Number(req.query.limit) || 20));
  const severity = req.query.severity;
  const reviewState = req.query.reviewState;
  if (severity && !TRIAGE_SEVERITIES.includes(severity)) throw new ApiError(422, 'Queue filter is invalid.');
  if (reviewState && ![
    'pending', 'auto_assessed', 'review_required', 'under_review',
    'confirmed', 'overridden', 'superseded'
  ].includes(reviewState)) throw new ApiError(422, 'Queue filter is invalid.');
  const query = {
    isCurrent: true,
    ...(severity ? { severity } : {}),
    ...(reviewState ? { reviewState } : {})
  };
  const severityRank = { critical: 0, high: 1, moderate: 2, low: 3 };
  const all = await TriageAssessment.find(query).lean();
  const ordered = all.sort((a, b) =>
    severityRank[a.severity] - severityRank[b.severity] ||
    new Date(a.createdAt) - new Date(b.createdAt)
  );
  return sendSuccess(res, { message: 'Triage queue fetched.', data: {
    assessments: ordered.slice((page - 1) * limit, page * limit).map((item) => ({
      caseId: item.complaintId, ...operationalTriageView(item)
    })),
    pagination: { page, limit, total: ordered.length, pages: Math.ceil(ordered.length / limit) }
  } });
});

export const triageHistory = asyncHandler(async (req, res) => {
  const complaint = await Complaint.findOne({ anonymousId: req.params.anonymousId }).lean();
  if (!complaint) throw new ApiError(404, 'Case not found.');
  const assessments = await TriageAssessment.find({ complaintId: req.params.anonymousId })
    .select('+internalReviewNote').sort({ version: -1 }).lean();
  return sendSuccess(res, { message: 'Triage history fetched.', data: {
    assessments: operationalTriageView(assessments, { history: true, privateView: true })
  } });
});

export const performTriageReview = asyncHandler(async (req, res) => {
  const previous = await TriageAssessment.findOne({
    complaintId: req.params.anonymousId,
    assessmentId: req.body.assessmentId,
    version: Number(req.body.version),
    isCurrent: true
  }).select('severity').lean();
  if (!previous) {
    throw new ApiError(409, 'The triage assessment changed. Refresh and try again.', {
      code: 'TRIAGE_STALE_REVIEW'
    });
  }
  const assessment = await reviewAssessment({
    complaintId: req.params.anonymousId,
    expectedAssessmentId: req.body.assessmentId, expectedVersion: req.body.version,
    severity: req.body.severity, action: req.body.action,
    overrideCategory: req.body.overrideCategory, note: req.body.note, actor: req.user
  });
  const downgraded = req.body.action === 'override' &&
    TRIAGE_SEVERITIES.indexOf(assessment.severity) <
    TRIAGE_SEVERITIES.indexOf(previous.severity);
  await createAuditLog({ userId: req.user.id, role: req.user.role,
    action: req.body.action === 'start_review' ? 'triage_review_started' :
      downgraded ? 'triage_downgraded' :
        req.body.action === 'confirm' ? 'triage_confirmed' : 'triage_overridden',
    resourceType: 'complaint', resourceRef: req.params.anonymousId,
    details: { stateFrom: previous.severity, stateTo: assessment.severity,
      category: req.body.overrideCategory }, req });
  return sendSuccess(res, { message: 'Triage review saved.', data: {
    assessment: operationalTriageView(assessment, { privateView: true })
  } });
});
