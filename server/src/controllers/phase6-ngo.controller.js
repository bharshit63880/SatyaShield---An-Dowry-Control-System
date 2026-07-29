import { NGO } from '../models/ngo.model.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { createAuditLog } from '../services/audit.service.js';
import {
  acknowledgeAssignment, listNgoAssignments, minimizedOfferPreview, rejectAssignment
} from '../services/ngo-assignment.service.js';
import {
  serializeNgoProfile, submitOwnNgoProfile, updateOwnNgoProfile
} from '../services/ngo-profile.service.js';
import { closeDeadlines, scheduleDeadline } from '../services/escalation-workflow.service.js';
import { revokeRealtimeComplaintAccess } from '../services/realtime-revocation.service.js';

const assignmentView = (item) => ({
  assignmentId: item.assignmentId, state: item.state, source: item.source,
  reasonCodes: item.recommendationReasonCodes, offeredAt: item.offeredAt,
  acknowledgedAt: item.acknowledgedAt, expiresAt: item.expiresAt
});

export const getOwnProfile = asyncHandler(async (req, res) => {
  const ngo = await NGO.findOne({ userId: req.user.id })
    .select('+registrationReference +operationalContact +phone +reviewNotes').lean();
  return sendSuccess(res, { message: 'Organization profile fetched.', data: { profile: serializeNgoProfile(ngo, { privateView: true }) } });
});
export const patchOwnProfile = asyncHandler(async (req, res) => {
  const ngo = await updateOwnNgoProfile(req.user.id, req.body);
  await createAuditLog({ userId: req.user.id, role: 'ngo', action: 'ngo_profile_updated',
    resourceType: 'account', resourceRef: ngo.publicId, details: { stateTo: ngo.verificationStatus }, req });
  return sendSuccess(res, { message: 'Organization profile updated.', data: { profile: serializeNgoProfile(ngo, { privateView: true }) } });
});
export const submitProfile = asyncHandler(async (req, res) => {
  const ngo = await submitOwnNgoProfile(req.user.id);
  await createAuditLog({ userId: req.user.id, role: 'ngo', action: 'ngo_profile_submitted',
    resourceType: 'account', resourceRef: ngo.publicId, details: { stateTo: 'submitted' }, req });
  return sendSuccess(res, { message: 'Organization profile submitted for review.', data: { profile: serializeNgoProfile(ngo) } });
});
export const assignments = asyncHandler(async (req, res) => sendSuccess(res, {
  message: 'Assignments fetched.', data: { assignments: (await listNgoAssignments(req.user)).map(assignmentView) }
}));
export const offerPreview = asyncHandler(async (req, res) => sendSuccess(res, {
  message: 'Assignment preview fetched.', data: { assignment: await minimizedOfferPreview(req.params.assignmentId, req.user) }
}));
export const acknowledge = asyncHandler(async (req, res) => {
  const value = await acknowledgeAssignment({ assignmentId: req.params.assignmentId, user: req.user, req });
  await closeDeadlines({
    complaintId: value.complaintId, triggerRef: value.assignmentId,
    status: 'acknowledged', outcomeCode: 'assignment_acknowledged'
  });
  return sendSuccess(res, { message: 'Assignment acknowledged.', data: { assignment: assignmentView(value) } });
});
export const reject = asyncHandler(async (req, res) => {
  const value = await rejectAssignment({ assignmentId: req.params.assignmentId, user: req.user,
    reasonCategory: String(req.body.reasonCategory || 'unable_to_accept').slice(0, 80), req });
  await closeDeadlines({
    complaintId: value.complaintId, triggerRef: value.assignmentId,
    status: 'cancelled', outcomeCode: 'assignment_rejected'
  });
  await scheduleDeadline({
    complaintId: value.complaintId, type: 'reassignment_review',
    triggerRef: `rejected:${value.assignmentId}`
  });
  await revokeRealtimeComplaintAccess({
    complaintId: value.complaintId, actorCategory: 'ngo'
  });
  return sendSuccess(res, { message: 'Assignment declined.', data: { assignment: assignmentView(value) } });
});
