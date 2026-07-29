import { env } from '../config/env.js';
import { NGO, NGO_REVIEW_REASONS } from '../models/ngo.model.js';
import { NgoAssignment } from '../models/ngo-assignment.model.js';
import { Complaint } from '../models/complaint.model.js';
import { ApiError } from '../utils/ApiError.js';
import { normalizeNgoProfileInput } from './ngo-router.service.js';
import { revokeRealtimeComplaintAccess } from './realtime-revocation.service.js';

const REVIEW_TRANSITIONS = {
  start_review: ['submitted'],
  request_changes: ['submitted', 'under_review'],
  approve: ['submitted', 'under_review'],
  reject: ['submitted', 'under_review'],
  suspend: ['approved'],
  restore: ['suspended'],
  deactivate: ['draft', 'submitted', 'under_review', 'changes_requested', 'approved', 'rejected', 'suspended']
};

export function serializeNgoProfile(ngo, { privateView = false } = {}) {
  const value = ngo?.toObject ? ngo.toObject() : ngo;
  if (!value) return null;
  const result = {
    publicId: value.publicId, name: value.name, organizationType: value.organizationType,
    registrationJurisdiction: value.registrationJurisdiction, website: value.website,
    publicContact: value.publicContact, city: value.city, district: value.district,
    description: value.description, supportedCategories: value.supportedCategories || [],
    supportedLanguages: value.supportedLanguages || [], coverage: value.coverage || [],
    remoteSupport: value.remoteSupport, serviceHours: value.serviceHours,
    emergencySupportCapability: value.emergencySupportCapability,
    verificationStatus: value.verificationStatus, profileVersion: value.profileVersion,
    approvedProfileVersion: value.approvedProfileVersion,
    operationalStatus: value.operationalStatus, acceptsNewAssignments: value.acceptsNewAssignments,
    temporaryUnavailableUntil: value.temporaryUnavailableUntil,
    maximumActiveAssignments: value.maximumActiveAssignments,
    currentActiveAssignments: value.currentActiveAssignments
  };
  if (privateView) Object.assign(result, {
    email: value.email, phone: value.phone, registrationReference: value.registrationReference,
    operationalContact: value.operationalContact, reviewReasonCategory: value.reviewReasonCategory,
    reviewNotes: value.reviewNotes, reviewedAt: value.reviewedAt,
    verificationReviewVersion: value.verificationReviewVersion, nextReviewAt: value.nextReviewAt
  });
  return result;
}

export async function updateOwnNgoProfile(userId, input) {
  const ngo = await NGO.findOne({ userId }).select('+registrationReference +operationalContact +phone +reviewNotes');
  if (!ngo) throw new ApiError(404, 'Organization profile not found.', { code: 'NGO_PROFILE_NOT_FOUND' });
  let normalized;
  try { normalized = normalizeNgoProfileInput(input); } catch (error) {
    throw new ApiError(400, error.message, { code: 'NGO_PROFILE_INVALID' });
  }
  const wasApproved = ngo.verificationStatus === 'approved';
  Object.assign(ngo, normalized);
  ngo.profileVersion += 1;
  if (wasApproved) {
    ngo.verificationStatus = 'changes_requested';
    ngo.operationalStatus = 'inactive';
    ngo.acceptsNewAssignments = false;
    await closeCurrentAssignments(ngo.publicId, 'withdrawn');
  }
  await ngo.save();
  return ngo;
}

export async function submitOwnNgoProfile(userId) {
  const ngo = await NGO.findOne({ userId });
  if (!ngo || !['draft', 'changes_requested', 'rejected'].includes(ngo.verificationStatus)) {
    throw new ApiError(409, 'Profile cannot be submitted in its current state.', { code: 'NGO_REVIEW_STATE_CONFLICT' });
  }
  normalizeNgoProfileInput(ngo.toObject());
  ngo.verificationStatus = 'submitted';
  ngo.operationalStatus = 'inactive';
  ngo.acceptsNewAssignments = false;
  await ngo.save();
  return ngo;
}

export async function closeCurrentAssignments(ngoPublicId, state = 'withdrawn') {
  const assignments = await NgoAssignment.find({ ngoPublicId, isCurrent: true });
  if (!assignments.length) return 0;
  await NgoAssignment.updateMany(
    { _id: { $in: assignments.map((item) => item._id) } },
    { state, isCurrent: false, withdrawnAt: new Date(), reasonCategory: 'profile_state_changed' }
  );
  await Complaint.updateMany(
    { anonymousId: { $in: assignments.map((item) => item.complaintId) } },
    { routingStatus: 'changed', assignedNgo: {} }
  );
  await NGO.updateOne({ publicId: ngoPublicId }, {
    currentActiveAssignments: 0, $inc: { capacityVersion: 1 }
  });
  await Promise.all(assignments.map((assignment) =>
    revokeRealtimeComplaintAccess({
      complaintId: assignment.complaintId, actorCategory: 'ngo'
    })
  ));
  return assignments.length;
}

export async function reviewNgoProfile({ publicId, action, profileVersion, reasonCategory, notes, reviewerId }) {
  const ngo = await NGO.findOne({ publicId })
    .select('+registrationReference +operationalContact +phone +reviewNotes');
  if (!ngo) throw new ApiError(404, 'Organization profile not found.', { code: 'NGO_PROFILE_NOT_FOUND' });
  if (String(ngo.userId) === String(reviewerId)) throw new ApiError(403, 'Self-review is not allowed.', {
    code: 'NGO_SELF_REVIEW_DENIED'
  });
  if (!REVIEW_TRANSITIONS[action]?.includes(ngo.verificationStatus) ||
      Number(profileVersion) !== ngo.profileVersion) {
    throw new ApiError(409, 'Review state or profile version has changed.', { code: 'NGO_REVIEW_STATE_CONFLICT' });
  }
  if (['request_changes', 'reject', 'suspend'].includes(action) &&
      (!NGO_REVIEW_REASONS.includes(reasonCategory) || !String(notes || '').trim())) {
    throw new ApiError(400, 'A safe reason category and review note are required.', {
      code: 'NGO_REVIEW_REASON_REQUIRED'
    });
  }
  const states = {
    start_review: 'under_review', request_changes: 'changes_requested', approve: 'approved',
    reject: 'rejected', suspend: 'suspended', restore: 'approved', deactivate: 'deactivated'
  };
  ngo.verificationStatus = states[action];
  ngo.reviewedAt = new Date();
  ngo.reviewedByRef = String(reviewerId);
  ngo.reviewReasonCategory = reasonCategory || null;
  ngo.reviewNotes = String(notes || '').trim().slice(0, 1000) || null;
  ngo.verificationReviewVersion = env.ngoReviewVersion;
  if (['approve', 'restore'].includes(action)) {
    ngo.approvedProfileVersion = ngo.profileVersion;
    ngo.operationalStatus = 'active';
    ngo.acceptsNewAssignments = true;
  } else {
    ngo.operationalStatus = action === 'suspend' ? 'suspended' :
      action === 'deactivate' ? 'deactivated' : 'inactive';
    ngo.acceptsNewAssignments = false;
  }
  if (['request_changes', 'reject', 'suspend', 'deactivate'].includes(action)) {
    await closeCurrentAssignments(ngo.publicId);
  }
  await ngo.save();
  return ngo;
}
