import { NGO } from '../models/ngo.model.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import { sendCreated, sendSuccess } from '../utils/apiResponse.js';
import { createAuditLog } from '../services/audit.service.js';
import {
  offerAssignment, reassignAssignment, routingCandidatesForComplaint, withdrawAssignment
} from '../services/ngo-assignment.service.js';
import { reviewNgoProfile, serializeNgoProfile } from '../services/ngo-profile.service.js';
import { closeDeadlines, scheduleDeadline } from '../services/escalation-workflow.service.js';
import { revokeRealtimeComplaintAccess } from '../services/realtime-revocation.service.js';

export const reviewQueue = asyncHandler(async (_req, res) => {
  const ngos = await NGO.find({ verificationStatus: { $in: ['submitted', 'under_review', 'changes_requested'] } })
    .sort({ updatedAt: 1 }).lean();
  return sendSuccess(res, { message: 'Review queue fetched.', data: { ngos: ngos.map(serializeNgoProfile) } });
});
export const reviewDetail = asyncHandler(async (req, res) => {
  const ngo = await NGO.findOne({ publicId: req.params.publicId })
    .select('+registrationReference +operationalContact +phone +reviewNotes').lean();
  if (!ngo) throw new ApiError(404, 'Organization profile not found.');
  return sendSuccess(res, { message: 'Review detail fetched.', data: { ngo: serializeNgoProfile(ngo, { privateView: true }) } });
});
export const reviewAction = asyncHandler(async (req, res) => {
  const ngo = await reviewNgoProfile({ publicId: req.params.publicId, action: req.params.action,
    profileVersion: req.body.profileVersion, reasonCategory: req.body.reasonCategory,
    notes: req.body.notes, reviewerId: req.user.id });
  await createAuditLog({ userId: req.user.id, role: req.user.role, action: 'ngo_review_transition',
    resourceType: 'account', resourceRef: ngo.publicId, details: { stateTo: ngo.verificationStatus }, req });
  return sendSuccess(res, { message: 'Review transition completed.', data: { ngo: serializeNgoProfile(ngo, { privateView: true }) } });
});
export const routingCandidates = asyncHandler(async (req, res) => {
  const result = await routingCandidatesForComplaint(req.params.anonymousId);
  if (result.outcome === 'no_match') {
    await scheduleDeadline({
      complaintId: req.params.anonymousId,
      type: 'no_eligible_ngo_review',
      triggerRef: `routing:${result.policyVersion}:${req.params.anonymousId}`
    });
  }
  return sendSuccess(res, { message: 'Routing evaluation completed.', data: {
    outcome: result.outcome, policyVersion: result.policyVersion,
    candidates: result.candidates.map(({ ngo, reasonCodes }) => ({
      publicId: ngo.publicId, name: ngo.name, reasonCodes,
      availableCapacity: ngo.maximumActiveAssignments - ngo.currentActiveAssignments
    }))
  } });
});
export const createOffer = asyncHandler(async (req, res) => {
  const assignment = await offerAssignment({ anonymousId: req.params.anonymousId,
    ngoPublicId: req.body.ngoPublicId, source: 'routing_recommendation',
    reasonCodes: [], actor: req.user, req });
  await scheduleDeadline({
    complaintId: req.params.anonymousId,
    type: 'ngo_offer_response',
    triggerRef: assignment.assignmentId,
    triggeredAt: assignment.offeredAt,
    dueAt: assignment.expiresAt
  });
  await revokeRealtimeComplaintAccess({
    complaintId: req.params.anonymousId, actorCategory: 'ngo'
  });
  return sendCreated(res, { message: 'Assignment offer created.', data: {
    assignment: { assignmentId: assignment.assignmentId, state: assignment.state, expiresAt: assignment.expiresAt }
  } });
});
export const withdrawOffer = asyncHandler(async (req, res) => {
  const assignment = await withdrawAssignment({ anonymousId: req.params.anonymousId,
    assignmentId: req.params.assignmentId, actor: req.user,
    reasonCategory: String(req.body.reasonCategory || 'administrative_change').slice(0, 80), req });
  await closeDeadlines({
    complaintId: req.params.anonymousId, triggerRef: assignment.assignmentId,
    status: 'cancelled', outcomeCode: 'assignment_withdrawn'
  });
  await scheduleDeadline({
    complaintId: req.params.anonymousId, type: 'reassignment_review',
    triggerRef: `withdrawn:${assignment.assignmentId}`
  });
  await revokeRealtimeComplaintAccess({
    complaintId: req.params.anonymousId, actorCategory: 'ngo'
  });
  return sendSuccess(res, { message: 'Assignment withdrawn.', data: { state: assignment.state } });
});
export const reassignOffer = asyncHandler(async (req, res) => {
  const { previous, next } = await reassignAssignment({
    anonymousId: req.params.anonymousId, assignmentId: req.params.assignmentId,
    ngoPublicId: req.body.ngoPublicId, actor: req.user,
    reasonCategory: String(req.body.reasonCategory || 'administrative_reassignment').slice(0, 80), req
  });
  await closeDeadlines({
    complaintId: req.params.anonymousId, triggerRef: previous.assignmentId,
    status: 'superseded', outcomeCode: 'assignment_reassigned'
  });
  await scheduleDeadline({
    complaintId: req.params.anonymousId, type: 'ngo_offer_response',
    triggerRef: next.assignmentId, triggeredAt: next.offeredAt, dueAt: next.expiresAt
  });
  await revokeRealtimeComplaintAccess({
    complaintId: req.params.anonymousId, actorCategory: 'ngo'
  });
  return sendSuccess(res, { message: 'Case reassigned; previous access was revoked.', data: {
    previousState: previous.state,
    assignment: { assignmentId: next.assignmentId, state: next.state, expiresAt: next.expiresAt }
  } });
});
