import { env } from '../config/env.js';
import { Escalation, ESCALATION_LEVELS } from '../models/escalation.model.js';
import {
  DEADLINE_STATES, DEADLINE_TYPES, WorkflowDeadline
} from '../models/workflow-deadline.model.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { createAuditLog } from '../services/audit.service.js';
import {
  runSchedulerBatch, transitionEscalation
} from '../services/escalation-workflow.service.js';
import { serializeEscalationForAdmin } from '../services/staff-serializer.service.js';

const deadlineView = (item) => ({
  deadlineId: item.deadlineId,
  complaintId: item.complaintId,
  deadlineType: item.deadlineType,
  policyVersion: item.policyVersion,
  dueAt: item.dueAt,
  status: item.status,
  priority: item.priority,
  attemptCount: item.attemptCount,
  lastEvaluatedAt: item.lastEvaluatedAt,
  acknowledgedAt: item.acknowledgedAt,
  resolvedAt: item.resolvedAt,
  safeOutcomeCode: item.safeOutcomeCode
});

export const deadlineQueue = asyncHandler(async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.max(1, Math.min(50, Number(req.query.limit) || 20));
  const status = req.query.status;
  const type = req.query.type;
  if (status && !DEADLINE_STATES.includes(status)) throw new ApiError(422, 'Deadline filter is invalid.');
  if (type && !DEADLINE_TYPES.includes(type)) throw new ApiError(422, 'Deadline filter is invalid.');
  const query = {
    ...(status ? { status } : {}),
    ...(type ? { deadlineType: type } : {})
  };
  const [items, total] = await Promise.all([
    WorkflowDeadline.find(query).sort({ priority: 1, dueAt: 1 })
      .skip((page - 1) * limit).limit(limit).lean(),
    WorkflowDeadline.countDocuments(query)
  ]);
  return sendSuccess(res, { message: 'Workflow deadline queue fetched.', data: {
    deadlines: items.map(deadlineView),
    timezone: env.escalationTimezone,
    targetNotice: 'Internal workflow targets are not guaranteed response times.',
    pagination: { page, limit, total, pages: Math.ceil(total / limit) }
  } });
});

export const escalationQueue = asyncHandler(async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.max(1, Math.min(50, Number(req.query.limit) || 20));
  const level = req.query.level;
  if (level && !ESCALATION_LEVELS.includes(level)) throw new ApiError(422, 'Escalation filter is invalid.');
  const query = level ? { level } : {};
  const rank = {
    critical_internal_attention: 0, senior_review: 1, priority_review: 2,
    assignment_attention: 3, review_due: 4, none: 5
  };
  const all = await Escalation.find(query).lean();
  const ordered = all.sort((a, b) =>
    rank[a.level] - rank[b.level] || new Date(a.createdAt) - new Date(b.createdAt));
  return sendSuccess(res, { message: 'Escalation queue fetched.', data: {
    escalations: ordered.slice((page - 1) * limit, page * limit)
      .map(serializeEscalationForAdmin),
    pagination: {
      page, limit, total: ordered.length, pages: Math.ceil(ordered.length / limit)
    }
  } });
});

export const escalationAction = asyncHandler(async (req, res) => {
  const escalation = await transitionEscalation({
    escalationId: req.params.escalationId,
    expectedVersion: req.body.version,
    action: req.body.action,
    reasonCategory: req.body.reasonCategory,
    note: req.body.note,
    actor: req.user
  });
  await createAuditLog({
    userId: req.user.id, role: req.user.role,
    action: `escalation_${req.body.action}`,
    resourceType: 'complaint', resourceRef: escalation.complaintId,
    details: {
      stateTo: escalation.status,
      category: req.body.reasonCategory,
      policyVersion: escalation.policyVersion
    }, req
  });
  return sendSuccess(res, { message: 'Escalation transition completed.', data: {
    escalation: serializeEscalationForAdmin(escalation)
  } });
});

export const runScheduler = asyncHandler(async (req, res) => {
  const dryRun = req.body.dryRun !== false;
  if (!dryRun && req.user.role !== 'superadmin') {
    throw new ApiError(403, 'Scheduler execution requires stronger authorization.', {
      code: 'SCHEDULER_EXECUTION_DENIED'
    });
  }
  const result = await runSchedulerBatch({
    dryRun,
    batchSize: Math.min(Number(req.body.batchSize) || env.escalationBatchSize,
      env.escalationBatchSize)
  });
  await createAuditLog({
    userId: req.user.id, role: req.user.role,
    action: dryRun ? 'scheduler_dry_run' : 'scheduler_manual_run',
    resourceType: 'system', resourceRef: env.escalationPolicyVersion,
    details: {
      policyVersion: env.escalationPolicyVersion,
      outcomeCode: dryRun ? 'zero_mutations' : 'bounded_execution'
    }, req
  });
  return sendSuccess(res, { message: 'Scheduler evaluation completed.', data: { result } });
});
