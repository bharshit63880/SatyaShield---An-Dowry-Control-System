import { env } from '../config/env.js';
import { Complaint } from '../models/complaint.model.js';
import { NGO } from '../models/ngo.model.js';
import { NgoAssignment } from '../models/ngo-assignment.model.js';
import { NgoConflict } from '../models/ngo-conflict.model.js';
import { ApiError } from '../utils/ApiError.js';
import { createAuditLog, safeResourceRef } from './audit.service.js';
import { evaluateRoutingCandidates, hardEligibility } from './ngo-router.service.js';

const CURRENT_STATES = ['offered', 'acknowledged', 'active'];
const RELEASE_STATES = ['rejected', 'expired', 'withdrawn', 'reassigned', 'completed'];

function transitionError() {
  return new ApiError(409, 'Assignment state transition is not allowed.', {
    code: 'ASSIGNMENT_STATE_CONFLICT'
  });
}

async function reserveCapacity(ngo) {
  if (!hardEligibility(ngo)) {
    throw new ApiError(409, 'The organization is not currently eligible for assignment.', {
      code: 'NGO_NOT_ELIGIBLE'
    });
  }
  const updated = await NGO.findOneAndUpdate({
    _id: ngo._id,
    verificationStatus: 'approved',
    operationalStatus: 'active',
    acceptsNewAssignments: true,
    ...(env.ngoCapacityEnforcementEnabled
      ? { $expr: { $lt: ['$currentActiveAssignments', '$maximumActiveAssignments'] } }
      : {})
  }, {
    $inc: { currentActiveAssignments: 1, capacityVersion: 1 },
    $set: { lastAssignedAt: new Date() }
  }, { new: true });
  if (!updated) throw new ApiError(409, 'Organization capacity is unavailable.', {
    code: 'NGO_CAPACITY_UNAVAILABLE'
  });
  return updated;
}

export async function releaseAssignmentCapacity(ngoPublicId) {
  await NGO.updateOne(
    { publicId: ngoPublicId, currentActiveAssignments: { $gt: 0 } },
    { $inc: { currentActiveAssignments: -1, capacityVersion: 1 } }
  );
}

export async function routingCandidatesForComplaint(anonymousId) {
  const complaint = await Complaint.findOne({ anonymousId })
    .select('+approximateLocationEncrypted').lean();
  if (!complaint) throw new ApiError(404, 'Case not found.', { code: 'CASE_NOT_FOUND' });
  return evaluateRoutingCandidates(complaint);
}

export async function offerAssignment({
  anonymousId, ngoPublicId, source = 'manual', reasonCodes = [], actor, req
}) {
  const [complaint, ngo, existing, conflict] = await Promise.all([
    Complaint.findOne({ anonymousId }).select('+approximateLocationEncrypted'),
    NGO.findOne({ publicId: ngoPublicId }),
    NgoAssignment.findOne({ complaintId: anonymousId, isCurrent: true }),
    NgoConflict.findOne({ complaintId: anonymousId, ngoPublicId, active: true })
  ]);
  if (!complaint) throw new ApiError(404, 'Case not found.', { code: 'CASE_NOT_FOUND' });
  if (!ngo || conflict || existing) throw new ApiError(409, 'Assignment cannot be created.', {
    code: 'ASSIGNMENT_UNAVAILABLE'
  });
  const routing = await evaluateRoutingCandidates(complaint.toObject());
  const candidate = routing.candidates.find((item) => item.ngo.publicId === ngoPublicId);
  if (!candidate) throw new ApiError(409, 'The organization is not currently eligible.', {
    code: 'NGO_NOT_ELIGIBLE'
  });
  await reserveCapacity(ngo);
  let assignment;
  try {
    assignment = await NgoAssignment.create({
      complaintId: anonymousId,
      ngoPublicId,
      state: 'offered',
      source,
      routingPolicyVersion: env.ngoRoutingPolicyVersion,
      recommendationReasonCodes: reasonCodes.length ? reasonCodes : candidate.reasonCodes,
      assignedByRef: safeResourceRef(actor?.id),
      offeredAt: new Date(),
      expiresAt: new Date(Date.now() + env.ngoAssignmentOfferMinutes * 60000)
    });
    complaint.routingStatus = 'offer_pending';
    await complaint.save();
  } catch (error) {
    await releaseAssignmentCapacity(ngoPublicId);
    throw error;
  }
  await createAuditLog({ userId: actor?.id, role: actor?.role, action: 'assignment_offered',
    resourceType: 'complaint', resourceRef: anonymousId, outcome: 'allowed',
    details: { category: source }, req });
  return assignment;
}

export async function acknowledgeAssignment({ assignmentId, user, req }) {
  const ngo = await NGO.findOne({ userId: user.id });
  if (!ngo || !hardEligibility({ ...ngo.toObject(), currentActiveAssignments: 0 })) {
    throw new ApiError(403, 'Assignment action is unavailable.', { code: 'RESOURCE_ACCESS_DENIED' });
  }
  const existing = await NgoAssignment.findOne({ assignmentId, ngoPublicId: ngo.publicId });
  if (existing?.state === 'acknowledged' || existing?.state === 'active') return existing;
  if (!existing || existing.state !== 'offered' || existing.expiresAt <= new Date()) {
    if (existing?.state === 'offered' && existing.expiresAt <= new Date()) {
      existing.state = 'expired'; existing.expiredAt = new Date(); existing.isCurrent = false;
      await existing.save();
      await Promise.all([
        releaseAssignmentCapacity(existing.ngoPublicId),
        Complaint.updateOne({ anonymousId: existing.complaintId }, {
          routingStatus: 'pending_admin_review', assignedNgo: {}
        })
      ]);
    }
    throw transitionError();
  }
  const assignment = await NgoAssignment.findOneAndUpdate(
    { _id: existing._id, state: 'offered', isCurrent: true, expiresAt: { $gt: new Date() } },
    { state: 'acknowledged', acknowledgedAt: new Date(), activatedAt: new Date() },
    { new: true }
  );
  if (!assignment) throw transitionError();
  await Complaint.updateOne({ anonymousId: assignment.complaintId }, {
    routingStatus: 'assigned',
    assignedNgo: {
      ngoId: ngo.publicId, name: ngo.name, city: ngo.city, district: ngo.district,
      coverageLabel: 'Platform-reviewed assignment', assignmentSource: assignment.source,
      matchedOn: assignment.recommendationReasonCodes[0], assignedAt: assignment.offeredAt,
      acknowledgedAt: assignment.acknowledgedAt
    }
  });
  await createAuditLog({ userId: user.id, role: 'ngo', action: 'assignment_acknowledged',
    resourceType: 'complaint', resourceRef: assignment.complaintId, outcome: 'allowed', req });
  return assignment;
}

export async function rejectAssignment({ assignmentId, user, reasonCategory, req }) {
  const ngo = await NGO.findOne({ userId: user.id }).lean();
  const assignment = await NgoAssignment.findOneAndUpdate(
    { assignmentId, ngoPublicId: ngo?.publicId, state: 'offered', isCurrent: true },
    { state: 'rejected', rejectedAt: new Date(), isCurrent: false, reasonCategory },
    { new: true }
  );
  if (!assignment) throw transitionError();
  await Promise.all([
    releaseAssignmentCapacity(assignment.ngoPublicId),
    NgoConflict.findOneAndUpdate(
      { complaintId: assignment.complaintId, ngoPublicId: assignment.ngoPublicId },
      { reasonCategory: 'ngo_recusal', active: true },
      { upsert: true }
    ),
    Complaint.updateOne({ anonymousId: assignment.complaintId }, {
      routingStatus: 'pending_admin_review', assignedNgo: {}
    })
  ]);
  await createAuditLog({ userId: user.id, role: 'ngo', action: 'assignment_rejected',
    resourceType: 'complaint', resourceRef: assignment.complaintId, outcome: 'allowed',
    details: { category: reasonCategory }, req });
  return assignment;
}

export async function withdrawAssignment({ anonymousId, assignmentId, actor, reasonCategory, req }) {
  const assignment = await NgoAssignment.findOneAndUpdate(
    { assignmentId, complaintId: anonymousId, state: { $in: CURRENT_STATES }, isCurrent: true },
    { state: 'withdrawn', withdrawnAt: new Date(), isCurrent: false, reasonCategory },
    { new: true }
  );
  if (!assignment) throw transitionError();
  await Promise.all([
    releaseAssignmentCapacity(assignment.ngoPublicId),
    Complaint.updateOne({ anonymousId }, {
      routingStatus: 'changed', assignedNgo: {}
    })
  ]);
  await createAuditLog({ userId: actor.id, role: actor.role, action: 'assignment_withdrawn',
    resourceType: 'complaint', resourceRef: anonymousId, outcome: 'allowed',
    details: { category: reasonCategory }, req });
  return assignment;
}

export async function reassignAssignment({
  anonymousId, assignmentId, ngoPublicId, actor, reasonCategory = 'administrative_reassignment', req
}) {
  const previous = await NgoAssignment.findOneAndUpdate(
    { assignmentId, complaintId: anonymousId, state: { $in: CURRENT_STATES }, isCurrent: true },
    { state: 'reassigned', withdrawnAt: new Date(), isCurrent: false, reasonCategory },
    { new: true }
  );
  if (!previous) throw transitionError();
  await Promise.all([
    releaseAssignmentCapacity(previous.ngoPublicId),
    Complaint.updateOne({ anonymousId }, { routingStatus: 'changed', assignedNgo: {} })
  ]);
  try {
    const next = await offerAssignment({
      anonymousId, ngoPublicId, source: 'manual',
      reasonCodes: ['administrative_reassignment'], actor, req
    });
    await createAuditLog({ userId: actor.id, role: actor.role, action: 'assignment_reassigned',
      resourceType: 'complaint', resourceRef: anonymousId, outcome: 'allowed',
      details: { category: reasonCategory }, req });
    return { previous, next };
  } catch (error) {
    // The old NGO remains revoked. A failed replacement is always safer than restoring stale access.
    throw error;
  }
}

export async function listNgoAssignments(user) {
  const ngo = await NGO.findOne({ userId: user.id }).lean();
  if (!ngo) return [];
  return NgoAssignment.find({ ngoPublicId: ngo.publicId }).sort({ createdAt: -1 }).lean();
}

export async function minimizedOfferPreview(assignmentId, user) {
  const ngo = await NGO.findOne({ userId: user.id }).lean();
  const assignment = await NgoAssignment.findOne({
    assignmentId, ngoPublicId: ngo?.publicId, state: 'offered', isCurrent: true
  }).lean();
  if (!assignment) throw new ApiError(404, 'Assignment not found.', { code: 'ASSIGNMENT_NOT_FOUND' });
  const complaint = await Complaint.findOne({ anonymousId: assignment.complaintId }).lean();
  return {
    assignmentId: assignment.assignmentId,
    state: assignment.state,
    category: complaint.complaintCategory,
    approximateAreaShared: Boolean(complaint.locationConsent),
    expiresAt: assignment.expiresAt
  };
}

export async function capacityDryRunReport() {
  const profiles = await NGO.find({}).lean();
  const active = await NgoAssignment.aggregate([
    { $match: { state: { $in: CURRENT_STATES }, isCurrent: true } },
    { $group: { _id: '$ngoPublicId', count: { $sum: 1 } } }
  ]);
  const counts = new Map(active.map((item) => [item._id, item.count]));
  return {
    mode: 'dry-run', mutationsPerformed: 0,
    mismatches: profiles.filter((ngo) =>
      ngo.currentActiveAssignments !== (counts.get(ngo.publicId) || 0)
    ).map((ngo) => ({
      ngoRef: safeResourceRef(ngo.publicId),
      recorded: ngo.currentActiveAssignments,
      computed: counts.get(ngo.publicId) || 0
    }))
  };
}
