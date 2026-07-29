import crypto from 'crypto';

import { env } from '../config/env.js';
import { Complaint } from '../models/complaint.model.js';
import { Escalation } from '../models/escalation.model.js';
import { NgoAssignment } from '../models/ngo-assignment.model.js';
import {
  ACTIVE_DEADLINE_STATES, WorkflowDeadline
} from '../models/workflow-deadline.model.js';
import { ApiError } from '../utils/ApiError.js';
import { createAuditLog, safeResourceRef } from './audit.service.js';
import { releaseAssignmentCapacity } from './ngo-assignment.service.js';

const minute = 60_000;
const activeEscalationStates = ['created', 'pending', 'acknowledged', 'action_in_progress'];
const retentionDate = (now) =>
  new Date(now.getTime() + env.complaintRetentionDays * 86_400_000);

export function deadlinePolicyFor({
  type, severity = null, triggeredAt = new Date(), triggerRef
}) {
  const at = new Date(triggeredAt);
  const definitions = {
    critical_human_review: {
      minutes: env.criticalReviewTargetMinutes, priority: 'critical'
    },
    triage_review: {
      minutes: severity === 'high' ? env.highReviewTargetMinutes :
        env.highReviewTargetMinutes,
      priority: severity === 'high' ? 'high' : 'routine'
    },
    ngo_offer_response: {
      minutes: env.ngoOfferResponseTargetMinutes, priority: 'high'
    },
    no_eligible_ngo_review: {
      minutes: env.noMatchReviewTargetMinutes, priority: 'high'
    },
    reassignment_review: {
      minutes: env.noMatchReviewTargetMinutes, priority: 'high'
    },
    unresolved_case_follow_up: {
      minutes: Math.max(env.highReviewTargetMinutes, 60), priority: 'routine'
    }
  };
  const selected = definitions[type];
  if (!selected || !triggerRef) {
    throw new ApiError(422, 'Deadline policy input is invalid.', {
      code: 'DEADLINE_POLICY_INVALID'
    });
  }
  return {
    deadlineType: type,
    dueAt: new Date(at.getTime() + selected.minutes * minute),
    priority: selected.priority,
    policyVersion: env.escalationPolicyVersion,
    triggerRef: String(triggerRef),
    activeKey: `${env.escalationPolicyVersion}:${type}:${triggerRef}`
  };
}

export async function scheduleDeadline({
  complaintId, type, severity, triggerRef, triggeredAt = new Date(),
  dueAt = null, now = new Date()
}) {
  const policy = deadlinePolicyFor({ type, severity, triggerRef, triggeredAt });
  if (dueAt) policy.dueAt = new Date(dueAt);
  return WorkflowDeadline.findOneAndUpdate(
    { activeKey: policy.activeKey, status: { $in: ACTIVE_DEADLINE_STATES } },
    {
      $setOnInsert: {
        complaintId, ...policy, status: 'scheduled',
        retentionPolicyVersion: env.retentionPolicyVersion,
        retentionEligibleAt: retentionDate(now)
      }
    },
    { upsert: true, new: true }
  );
}

export async function closeDeadlines({
  complaintId, triggerRef = null, types = null, status = 'superseded',
  outcomeCode = 'trigger_superseded', now = new Date()
}) {
  const query = {
    complaintId, status: { $in: ACTIVE_DEADLINE_STATES },
    ...(triggerRef ? { triggerRef: String(triggerRef) } : {}),
    ...(types ? { deadlineType: { $in: types } } : {})
  };
  return WorkflowDeadline.updateMany(query, {
    status,
    safeOutcomeCode: outcomeCode,
    lastEvaluatedAt: now,
    ...(status === 'resolved' ? { resolvedAt: now } :
      status === 'acknowledged' ? { acknowledgedAt: now } : { cancelledAt: now }),
    $unset: { leaseOwner: 1, leaseUntil: 1 }
  });
}

const escalationPolicy = (deadline) => {
  const map = {
    critical_human_review: {
      level: 'critical_internal_attention',
      triggerCategory: 'critical_review_overdue',
      reasonCodes: ['critical_human_review_due'],
      role: 'superadmin'
    },
    triage_review: {
      level: deadline.priority === 'high' ? 'priority_review' : 'review_due',
      triggerCategory: 'triage_review_overdue',
      reasonCodes: ['human_review_due'],
      role: 'admin'
    },
    ngo_offer_response: {
      level: 'assignment_attention',
      triggerCategory: 'assignment_response_overdue',
      reasonCodes: ['ngo_offer_expired'],
      role: 'admin'
    },
    no_eligible_ngo_review: {
      level: 'assignment_attention',
      triggerCategory: 'routing_no_match',
      reasonCodes: ['no_eligible_ngo'],
      role: 'admin'
    },
    reassignment_review: {
      level: 'senior_review',
      triggerCategory: 'reassignment_required',
      reasonCodes: ['assignment_replacement_required'],
      role: 'admin'
    },
    unresolved_case_follow_up: {
      level: 'review_due',
      triggerCategory: 'unresolved_follow_up',
      reasonCodes: ['case_follow_up_due'],
      role: 'admin'
    }
  };
  return map[deadline.deadlineType];
};

export async function createEscalationForDeadline(deadline, now = new Date()) {
  const policy = escalationPolicy(deadline);
  if (!policy) throw new Error('unsupported_deadline_type');
  const idempotencyKey = `deadline:${deadline.deadlineId}:${env.escalationPolicyVersion}`;
  return Escalation.findOneAndUpdate(
    { idempotencyKey },
    {
      $setOnInsert: {
        complaintId: deadline.complaintId,
        sourceDeadlineId: deadline.deadlineId,
        idempotencyKey,
        policyVersion: env.escalationPolicyVersion,
        level: policy.level,
        triggerCategory: policy.triggerCategory,
        reasonCodes: policy.reasonCodes,
        assignedRoleCategory: policy.role,
        status: 'pending',
        version: 1,
        transitions: [{
          from: null, to: 'pending', reasonCategory: policy.triggerCategory,
          actorCategory: 'system', actorRef: null, at: now
        }],
        retentionPolicyVersion: env.retentionPolicyVersion,
        retentionEligibleAt: retentionDate(now)
      }
    },
    { upsert: true, new: true }
  );
}

export async function createManualEscalation({
  complaintId, reasonCategory, actor, idempotencyKey, now = new Date()
}) {
  const allowed = [
    'new_information', 'assignment_attention', 'human_review_requested',
    'unresolved_case', 'administrative_review'
  ];
  if (!allowed.includes(reasonCategory)) {
    throw new ApiError(422, 'Escalation reason is invalid.', {
      code: 'ESCALATION_REASON_INVALID'
    });
  }
  const complaint = await Complaint.findOne({ anonymousId: complaintId }).lean();
  if (!complaint) throw new ApiError(404, 'Case not found.', { code: 'CASE_NOT_FOUND' });
  const safeKey = String(idempotencyKey || '').trim().slice(0, 100);
  if (!/^[a-zA-Z0-9_-]{8,100}$/.test(safeKey)) {
    throw new ApiError(422, 'A valid idempotency key is required.', {
      code: 'IDEMPOTENCY_KEY_INVALID'
    });
  }
  const level = complaint.currentTriageSeverity === 'critical'
    ? 'critical_internal_attention' : 'priority_review';
  return Escalation.findOneAndUpdate(
    { idempotencyKey: `manual:${complaintId}:${safeKey}` },
    {
      $setOnInsert: {
        complaintId, level, triggerCategory: reasonCategory,
        sourceDeadlineId: null,
        idempotencyKey: `manual:${complaintId}:${safeKey}`,
        policyVersion: env.escalationPolicyVersion,
        reasonCodes: [reasonCategory],
        assignedRoleCategory: level === 'critical_internal_attention' ? 'superadmin' : 'admin',
        status: 'pending', version: 1,
        transitions: [{
          from: null, to: 'pending', reasonCategory,
          actorCategory: actor.role, actorRef: safeResourceRef(actor.id), at: now
        }],
        retentionPolicyVersion: env.retentionPolicyVersion,
        retentionEligibleAt: retentionDate(now)
      }
    },
    { upsert: true, new: true }
  );
}

export async function claimDueDeadline({
  now = new Date(), workerId = `worker-${crypto.randomUUID()}`
} = {}) {
  const leaseUntil = new Date(now.getTime() + env.escalationLeaseSeconds * 1000);
  return WorkflowDeadline.findOneAndUpdate({
    status: { $in: ACTIVE_DEADLINE_STATES },
    dueAt: { $lte: now },
    attemptCount: { $lt: env.escalationMaxAttempts },
    $and: [
      { $or: [{ nextAttemptAt: null }, { nextAttemptAt: { $lte: now } }] },
      { $or: [{ leaseUntil: null }, { leaseUntil: { $lte: now } }] }
    ]
  }, {
    $set: {
      status: 'overdue', lastEvaluatedAt: now, leaseOwner: workerId, leaseUntil
    },
    $inc: { attemptCount: 1 }
  }, {
    new: true,
    sort: { priority: 1, dueAt: 1 },
    select: '+leaseOwner +leaseUntil'
  });
}

async function expireOfferExactlyOnce(deadline, now) {
  const assignment = await NgoAssignment.findOneAndUpdate({
    assignmentId: deadline.triggerRef,
    complaintId: deadline.complaintId,
    state: 'offered',
    isCurrent: true,
    expiresAt: { $lte: now }
  }, {
    state: 'expired', isCurrent: false, expiredAt: now,
    reasonCategory: 'offer_deadline_expired'
  }, { new: true });
  if (!assignment) return false;
  await Promise.all([
    releaseAssignmentCapacity(assignment.ngoPublicId),
    Complaint.updateOne({ anonymousId: assignment.complaintId }, {
      routingStatus: 'pending_admin_review', assignedNgo: {}
    })
  ]);
  return true;
}

export async function processClaimedDeadline(deadline, {
  now = new Date(), workerId
} = {}) {
  if (!deadline || deadline.leaseOwner !== workerId) {
    throw new Error('deadline_lease_invalid');
  }
  try {
    if (deadline.deadlineType === 'ngo_offer_response') {
      await expireOfferExactlyOnce(deadline, now);
    }
    const escalation = await createEscalationForDeadline(deadline, now);
    await WorkflowDeadline.updateOne({
      _id: deadline._id, leaseOwner: workerId
    }, {
      status: 'resolved', resolvedAt: now, lastEvaluatedAt: now,
      safeOutcomeCode: 'escalation_created',
      $unset: { leaseOwner: 1, leaseUntil: 1, nextAttemptAt: 1 }
    });
    await createAuditLog({
      role: 'system', action: 'deadline_escalated',
      resourceType: 'complaint', resourceRef: deadline.complaintId,
      details: {
        category: deadline.deadlineType,
        policyVersion: env.escalationPolicyVersion,
        outcomeCode: escalation.triggerCategory
      }
    });
    return escalation;
  } catch (error) {
    const exhausted = deadline.attemptCount >= env.escalationMaxAttempts;
    const backoffSeconds = Math.min(300, 2 ** Math.min(deadline.attemptCount, 8));
    await WorkflowDeadline.updateOne({
      _id: deadline._id, leaseOwner: workerId
    }, {
      safeOutcomeCode: exhausted ? 'retry_exhausted' : 'retry_scheduled',
      nextAttemptAt: exhausted ? null : new Date(now.getTime() + backoffSeconds * 1000),
      $unset: { leaseOwner: 1, leaseUntil: 1 }
    });
    throw error;
  }
}

export async function runSchedulerBatch({
  now = new Date(), workerId = `worker-${crypto.randomUUID()}`,
  batchSize = env.escalationBatchSize, dryRun = false
} = {}) {
  if (dryRun) {
    const due = await WorkflowDeadline.countDocuments({
      status: { $in: ACTIVE_DEADLINE_STATES }, dueAt: { $lte: now }
    });
    return { mode: 'dry-run', evaluatedAt: now, due, mutationsPerformed: 0 };
  }
  const result = { mode: 'execute', evaluatedAt: now, claimed: 0, processed: 0, failed: 0 };
  for (let index = 0; index < Math.min(batchSize, env.escalationBatchSize); index += 1) {
    const deadline = await claimDueDeadline({ now, workerId });
    if (!deadline) break;
    result.claimed += 1;
    try {
      await processClaimedDeadline(deadline, { now, workerId });
      result.processed += 1;
    } catch {
      result.failed += 1;
    }
  }
  return result;
}

export async function transitionEscalation({
  escalationId, expectedVersion, action, reasonCategory, note, actor, now = new Date()
}) {
  const targets = {
    acknowledge: 'acknowledged',
    start_action: 'action_in_progress',
    resolve: 'resolved',
    cancel: 'cancelled',
    reopen: 'pending'
  };
  const target = targets[action];
  const allowedReasons = [
    'review_started', 'assignment_follow_up', 'information_reviewed',
    'workflow_completed', 'invalid_trigger', 'superseded_workflow',
    'new_information', 'reopened_for_review'
  ];
  if (!target || !allowedReasons.includes(reasonCategory)) {
    throw new ApiError(422, 'Escalation transition is invalid.', {
      code: 'ESCALATION_TRANSITION_INVALID'
    });
  }
  const existing = await Escalation.findOne({ escalationId }).select('+transitions.note');
  if (!existing) throw new ApiError(404, 'Escalation not found.');
  if (existing.status === target) return existing;
  if (Number(expectedVersion) !== existing.version) {
    throw new ApiError(409, 'Escalation changed. Refresh and try again.', {
      code: 'ESCALATION_VERSION_CONFLICT'
    });
  }
  if (existing.level === 'critical_internal_attention' &&
      ['resolve', 'cancel'].includes(action) && actor.role !== 'superadmin') {
    throw new ApiError(403, 'Critical escalation closure requires stronger authorization.', {
      code: 'ESCALATION_CRITICAL_CLOSE_DENIED'
    });
  }
  const boundedNote = String(note || '').replace(/[\u0000-\u001f\u007f]/g, ' ')
    .trim().slice(0, 500) || null;
  const update = {
    status: target,
    $inc: { version: 1 },
    $push: {
      transitions: {
        from: existing.status, to: target, reasonCategory,
        actorCategory: actor.role, actorRef: safeResourceRef(actor.id),
        note: boundedNote, at: now
      }
    }
  };
  if (target === 'acknowledged') update.acknowledgedAt = now;
  if (target === 'resolved') {
    update.resolvedAt = now;
    update.resolutionCategory = reasonCategory;
  }
  if (target === 'cancelled') update.cancelledAt = now;
  const updated = await Escalation.findOneAndUpdate({
    _id: existing._id, version: existing.version, status: existing.status
  }, update, { new: true });
  if (!updated) throw new ApiError(409, 'Escalation changed. Refresh and try again.', {
    code: 'ESCALATION_VERSION_CONFLICT'
  });
  if (['resolved', 'cancelled'].includes(target) && updated.sourceDeadlineId) {
    await closeDeadlines({
      complaintId: updated.complaintId,
      triggerRef: updated.sourceDeadlineId,
      status: target === 'resolved' ? 'resolved' : 'cancelled',
      outcomeCode: `escalation_${target}`,
      now
    });
  }
  return updated;
}

export function reporterWorkflowStatus(escalation) {
  if (!escalation) return 'Awaiting review';
  if (escalation.level === 'critical_internal_attention' ||
      escalation.level === 'priority_review') return 'Priority review';
  if (escalation.level === 'assignment_attention') {
    return escalation.triggerCategory === 'assignment_response_overdue'
      ? 'Assignment response pending' : 'Organization assignment pending';
  }
  if (escalation.status === 'resolved') return 'Review completed';
  if (activeEscalationStates.includes(escalation.status)) return 'Support workflow active';
  return 'Additional review required';
}
