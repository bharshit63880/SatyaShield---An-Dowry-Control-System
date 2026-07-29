import { SosRequest, ACTIVE_SOS_STATES } from '../models/sos-request.model.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import { sendCreated, sendSuccess } from '../utils/apiResponse.js';
import { createAuditLog } from '../services/audit.service.js';
import {
  activateSos, cancelSos, readSosLocation, serializeSos, sosActorFromRequest,
  startSosConfirmation, transitionSos
} from '../services/sos.service.js';

export const startConfirmation = asyncHandler(async (req, res) => {
  const actor = sosActorFromRequest(req);
  const result = await startSosConfirmation({
    complaintId: req.params.anonymousId,
    actor,
    acknowledgedNonDispatch: req.body.acknowledgedNonDispatch,
    idempotencyKey: req.body.idempotencyKey
  });
  await createAuditLog({
    role: 'reporter',
    action: result.duplicate ? 'sos_duplicate_prevented' : 'sos_confirmation_started',
    resourceType: 'complaint', resourceRef: req.params.anonymousId,
    details: { policyVersion: result.request.policyVersion }, req
  });
  return sendCreated(res, {
    message: result.duplicate
      ? 'Existing safety request returned.'
      : 'Safety-request confirmation countdown started.',
    data: {
      sos: serializeSos(result.request),
      duplicate: result.duplicate
    }
  });
});

export const cancelConfirmation = asyncHandler(async (req, res) => {
  const request = await cancelSos({
    complaintId: req.params.anonymousId,
    sosId: req.params.sosId,
    actor: sosActorFromRequest(req)
  });
  await createAuditLog({
    role: 'reporter', action: 'sos_cancelled',
    resourceType: 'complaint', resourceRef: req.params.anonymousId,
    details: { stateTo: request.state, policyVersion: request.policyVersion }, req
  });
  return sendSuccess(res, {
    message: 'Safety request cancelled during confirmation.',
    data: { sos: serializeSos(request) }
  });
});

export const activate = asyncHandler(async (req, res) => {
  const request = await activateSos({
    complaintId: req.params.anonymousId,
    sosId: req.params.sosId,
    expectedVersion: req.body.version,
    actor: sosActorFromRequest(req),
    locationConsent: req.body.locationConsent === true,
    locationMode: req.body.locationMode || 'none',
    location: req.body.location
  });
  await createAuditLog({
    role: 'reporter', action: 'sos_created',
    resourceType: 'complaint', resourceRef: req.params.anonymousId,
    details: {
      stateTo: request.state,
      policyVersion: request.policyVersion,
      outcomeCode: 'internal_routing_only'
    }, req
  });
  if (request.locationConsent) {
    await createAuditLog({
      role: 'reporter', action: 'sos_location_consent_recorded',
      resourceType: 'complaint', resourceRef: req.params.anonymousId,
      details: { category: request.locationMode, policyVersion: request.policyVersion }, req
    });
  }
  return sendSuccess(res, {
    message: 'Safety request persisted and routed internally.',
    data: { sos: serializeSos(request) }
  });
});

export const getCurrentSos = asyncHandler(async (req, res) => {
  const request = await SosRequest.findOne({
    complaintId: req.params.anonymousId
  }).sort({ createdAt: -1 }).lean();
  return sendSuccess(res, {
    message: 'Safety-request status fetched.',
    data: { sos: request ? serializeSos(request, { staff: !req.reporterCaseAccess }) : null }
  });
});

export const sosQueue = asyncHandler(async (_req, res) => {
  const requests = await SosRequest.find({
    state: { $in: ACTIVE_SOS_STATES }
  }).sort({ createdAt: 1 }).limit(100).lean();
  return sendSuccess(res, {
    message: 'Internal safety-request queue fetched.',
    data: {
      requests: requests.map((item) => serializeSos(item, { staff: true })),
      notice: 'Internal routing is not emergency dispatch or proof of external delivery.'
    }
  });
});

export const staffAction = asyncHandler(async (req, res) => {
  const request = await transitionSos({
    complaintId: req.params.anonymousId,
    sosId: req.params.sosId,
    expectedVersion: req.body.version,
    action: req.body.action,
    actor: sosActorFromRequest(req)
  });
  const actionMap = {
    acknowledge: 'sos_acknowledged',
    start_action: 'sos_action_in_progress',
    resolve: 'sos_resolved',
    false_alarm: 'sos_false_alarm_marked',
    close: 'sos_closed'
  };
  await createAuditLog({
    userId: req.user.id, role: req.user.role, action: actionMap[req.body.action],
    resourceType: 'complaint', resourceRef: req.params.anonymousId,
    details: { stateTo: request.state, policyVersion: request.policyVersion }, req
  });
  return sendSuccess(res, {
    message: 'Safety-request workflow updated.',
    data: { sos: serializeSos(request, { staff: true }) }
  });
});

export const getLocation = asyncHandler(async (req, res) => {
  const actor = sosActorFromRequest(req);
  const value = await readSosLocation({
    complaintId: req.params.anonymousId,
    sosId: req.params.sosId,
    actor
  });
  await createAuditLog({
    userId: req.user.id, role: req.user.role, action: 'sos_location_accessed',
    resourceType: 'complaint', resourceRef: req.params.anonymousId,
    details: { category: value.precision }, req
  });
  return sendSuccess(res, {
    message: 'Consent-limited SOS location fetched.',
    data: value
  });
});
