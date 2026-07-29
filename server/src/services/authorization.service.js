import { Complaint } from '../models/complaint.model.js';
import { Investigator } from '../models/investigator.model.js';
import { NGO } from '../models/ngo.model.js';
import { NgoAssignment } from '../models/ngo-assignment.model.js';
import { ApiError } from '../utils/ApiError.js';

export const COMPLAINT_ACTIONS = Object.freeze({
  READ: 'complaint:read',
  TIMELINE_READ: 'complaint:timeline:read',
  EVIDENCE_READ: 'complaint:evidence:read',
  EVIDENCE_UPLOAD: 'complaint:evidence:upload',
  EVIDENCE_DOWNLOAD: 'complaint:evidence:download',
  CHAT_READ: 'complaint:chat:read',
  CHAT_SEND: 'complaint:chat:send',
  CHAT_MARK_READ: 'complaint:chat:mark-read',
  INVESTIGATION_NOTE_ADD: 'complaint:investigation-note:add',
  STATUS_UPDATE: 'complaint:status:update',
  NGO_ASSIGN: 'complaint:ngo:assign',
  NGO_ACKNOWLEDGE: 'complaint:ngo:acknowledge',
  INVESTIGATOR_ASSIGN: 'complaint:investigator:assign',
  ESCALATE: 'complaint:escalate'
  ,TRIAGE_READ: 'complaint:triage:read',
  TRIAGE_REVIEW_REQUEST: 'complaint:triage:review-request',
  SOS_READ: 'complaint:sos:read',
  SOS_CREATE: 'complaint:sos:create',
  SOS_CANCEL: 'complaint:sos:cancel'
});

const ADMIN_ACTIONS = new Set(Object.values(COMPLAINT_ACTIONS));
const NGO_ACTIONS = new Set([
  COMPLAINT_ACTIONS.READ,
  COMPLAINT_ACTIONS.TIMELINE_READ,
  COMPLAINT_ACTIONS.EVIDENCE_READ,
  COMPLAINT_ACTIONS.EVIDENCE_UPLOAD,
  COMPLAINT_ACTIONS.EVIDENCE_DOWNLOAD,
  COMPLAINT_ACTIONS.CHAT_READ,
  COMPLAINT_ACTIONS.CHAT_SEND,
  COMPLAINT_ACTIONS.CHAT_MARK_READ,
  COMPLAINT_ACTIONS.NGO_ACKNOWLEDGE
  ,COMPLAINT_ACTIONS.TRIAGE_READ, COMPLAINT_ACTIONS.TRIAGE_REVIEW_REQUEST
  ,COMPLAINT_ACTIONS.SOS_READ
]);
const INVESTIGATOR_ACTIONS = new Set([
  COMPLAINT_ACTIONS.READ,
  COMPLAINT_ACTIONS.TIMELINE_READ,
  COMPLAINT_ACTIONS.EVIDENCE_READ,
  COMPLAINT_ACTIONS.EVIDENCE_UPLOAD,
  COMPLAINT_ACTIONS.EVIDENCE_DOWNLOAD,
  COMPLAINT_ACTIONS.CHAT_READ,
  COMPLAINT_ACTIONS.CHAT_SEND,
  COMPLAINT_ACTIONS.CHAT_MARK_READ,
  COMPLAINT_ACTIONS.INVESTIGATION_NOTE_ADD
  ,COMPLAINT_ACTIONS.TRIAGE_READ, COMPLAINT_ACTIONS.TRIAGE_REVIEW_REQUEST
  ,COMPLAINT_ACTIONS.SOS_READ
]);

export function authorizationDenied() {
  return new ApiError(403, 'You are not authorized to perform this action.', {
    code: 'RESOURCE_ACCESS_DENIED'
  });
}

export async function resolveStaffActor(user) {
  if (!user) {
    throw new ApiError(401, 'Authentication is required.', { code: 'AUTH_REQUIRED' });
  }

  if (['admin', 'superadmin'].includes(user.role)) {
    return { role: user.role, userId: String(user.id) };
  }

  if (user.role === 'ngo') {
    const profile = await NGO.findOne({ userId: user.id }).lean();
    if (
      !profile ||
      profile.verificationStatus !== 'approved' ||
      profile.operationalStatus !== 'active' ||
      profile.approvedProfileVersion !== profile.profileVersion
    ) {
      throw authorizationDenied();
    }

    return {
      role: 'ngo',
      userId: String(user.id),
      ngoId: profile.publicId,
      profile
    };
  }

  if (user.role === 'investigator') {
    const profile = await Investigator.findOne({ userId: user.id }).lean();
    if (!profile || profile.isActive !== true || profile.isEligible !== true) {
      throw authorizationDenied();
    }

    return {
      role: 'investigator',
      userId: String(user.id),
      investigatorId: String(profile.userId),
      profile
    };
  }

  throw authorizationDenied();
}

export function canAccessComplaint({ actor, complaint, action, assignment }) {
  if (!actor || !complaint || !action) {
    return false;
  }

  if (['admin', 'superadmin'].includes(actor.role)) {
    return ADMIN_ACTIONS.has(action);
  }

  if (actor.role === 'ngo') {
    return (
      NGO_ACTIONS.has(action) &&
      Boolean(assignment) &&
      assignment.isCurrent === true &&
      ['acknowledged', 'active'].includes(assignment.state) &&
      assignment.ngoPublicId === actor.ngoId &&
      assignment.complaintId === complaint.anonymousId
    );
  }

  if (actor.role === 'investigator') {
    return (
      INVESTIGATOR_ACTIONS.has(action) &&
      Boolean(complaint.assignedInvestigator?.investigatorId) &&
      String(complaint.assignedInvestigator.investigatorId) === actor.investigatorId
    );
  }

  return false;
}

export async function authorizeComplaintForStaff({
  user,
  anonymousId,
  action,
  complaintModel = Complaint
}) {
  const actor = await resolveStaffActor(user);
  const complaint = await complaintModel.findOne({ anonymousId })
    .select('+approximateLocationEncrypted +descriptionEncrypted')
    .lean();

  const assignment = actor.role === 'ngo' && complaint
    ? await NgoAssignment.findOne({
        complaintId: anonymousId,
        ngoPublicId: actor.ngoId,
        state: { $in: ['acknowledged', 'active'] },
        isCurrent: true
      }).lean()
    : null;

  if (!canAccessComplaint({ actor, complaint, action, assignment })) {
    throw authorizationDenied();
  }

  return { actor, complaint };
}

export async function buildComplaintListScope(user) {
  const actor = await resolveStaffActor(user);
  if (['admin', 'superadmin'].includes(actor.role)) {
    return { actor, query: {} };
  }

  if (actor.role === 'ngo') {
    const assignments = await NgoAssignment.find({
      ngoPublicId: actor.ngoId,
      state: { $in: ['acknowledged', 'active'] },
      isCurrent: true
    }).select('complaintId -_id').lean();
    return { actor, query: { anonymousId: { $in: assignments.map((item) => item.complaintId) } } };
  }

  if (actor.role === 'investigator') {
    return {
      actor,
      query: { 'assignedInvestigator.investigatorId': actor.investigatorId }
    };
  }

  throw authorizationDenied();
}

export function assertAdministrativeWorkflow(user) {
  if (!user || !['admin', 'superadmin'].includes(user.role)) {
    throw authorizationDenied();
  }
}
