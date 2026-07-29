import { env } from '../config/env.js';
import { Complaint } from '../models/complaint.model.js';
import { SosRequest, ACTIVE_SOS_STATES } from '../models/sos-request.model.js';
import { ApiError } from '../utils/ApiError.js';
import { decryptSensitiveValue, encryptSensitiveValue } from '../utils/crypto.js';
import { safeResourceRef } from './audit.service.js';
import { publishRealtimeCaseEvent } from './realtime-revocation.service.js';

export const SOS_NON_DISPATCH_NOTICE =
  'SatyaShield may not contact police, ambulance services, emergency responders or an NGO automatically. Network, device and service failures are possible. If immediate danger exists, move to safety where possible and deliberately contact an appropriate local emergency service or trusted person.';

export const sosExternalDeliveryMetrics = Object.seal({ invocationCount: 0 });

const safeKey = (value) => {
  const key = String(value || '').trim();
  if (!/^[a-zA-Z0-9_-]{8,100}$/.test(key)) {
    throw new ApiError(422, 'A valid idempotency key is required.', {
      code: 'SOS_IDEMPOTENCY_INVALID'
    });
  }
  return key;
};
const transition = (from, to, outcomeCode, actor, at) => ({
  from, to, outcomeCode, actorCategory: actor.category,
  actorRef: actor.ref || null, at
});

export function sosActorFromRequest(req) {
  if (req.reporterCaseAccess) return {
    category: 'reporter',
    ref: safeResourceRef(`reporter:${req.reporterCaseAccess.caseId}`),
    reporter: true
  };
  return {
    category: req.user.role,
    ref: safeResourceRef(`staff:${req.user.id}`),
    reporter: false
  };
}

export function serializeSos(request, { staff = false } = {}) {
  return {
    sosId: request.sosId,
    caseId: request.complaintId,
    state: request.state,
    version: request.version,
    createdAt: request.createdAt,
    cancelUntil: request.state === 'confirmation_pending' ? request.cancelUntil : null,
    cancelledAt: request.cancelledAt,
    internalRoutedAt: request.internalRoutedAt,
    staffAcknowledgedAt: request.staffAcknowledgedAt,
    resolvedAt: request.resolvedAt,
    locationShared: Boolean(request.locationConsent),
    locationMode: request.locationConsent ? request.locationMode : 'none',
    internalRoutingOnly: true,
    externalDeliveryAttempted: false,
    statusNotice: request.state === 'routed_internal'
      ? 'The request entered SatyaShield’s authorized internal queue. This does not mean an external emergency service was contacted.'
      : SOS_NON_DISPATCH_NOTICE,
    ...(staff ? {
      policyVersion: request.policyVersion,
      safeFailureCode: request.safeFailureCode,
      safeOutcomeCode: request.safeOutcomeCode
    } : {})
  };
}

export async function startSosConfirmation({
  complaintId, actor, acknowledgedNonDispatch, idempotencyKey, now = new Date()
}) {
  if (!env.sosEnabled) throw new ApiError(503, 'SOS safety requests are unavailable.', {
    code: 'SOS_UNAVAILABLE'
  });
  if (!actor.reporter || acknowledgedNonDispatch !== true) {
    throw new ApiError(422, 'Explicit confirmation of the safety notice is required.', {
      code: 'SOS_CONFIRMATION_REQUIRED'
    });
  }
  const complaint = await Complaint.findOne({ anonymousId: complaintId }).lean();
  if (!complaint) throw new ApiError(404, 'Case not found.', { code: 'CASE_NOT_FOUND' });
  const key = `sos:${complaintId}:${safeKey(idempotencyKey)}`;
  const replay = await SosRequest.findOne({ idempotencyKey: key }).lean();
  if (replay) return { request: replay, duplicate: true };
  const existing = await SosRequest.findOne({
    complaintId, state: { $in: ACTIVE_SOS_STATES }
  }).lean();
  if (existing) return { request: existing, duplicate: true };
  const cancelUntil = new Date(now.getTime() + env.sosConfirmationSeconds * 1000);
  const activeExpiresAt = new Date(now.getTime() + env.sosActiveExpiryMinutes * 60000);
  try {
    const request = await SosRequest.create({
      complaintId,
      reporterScopeRef: actor.ref,
      idempotencyKey: key,
      state: 'confirmation_pending',
      policyVersion: env.sosPolicyVersion,
      confirmationNoticeVersion: `${env.sosPolicyVersion}:non-dispatch-v1`,
      cancelUntil,
      activeExpiresAt,
      locationConsent: false,
      locationMode: 'none',
      locationPrecision: 'none',
      transitions: [
        transition(null, 'confirmation_pending', 'explicit_confirmation_started', actor, now)
      ]
    });
    return { request, duplicate: false };
  } catch (error) {
    if (error?.code !== 11000) throw error;
    return {
      request: await SosRequest.findOne({
        complaintId, state: { $in: ACTIVE_SOS_STATES }
      }).lean(),
      duplicate: true
    };
  }
}

export async function cancelSos({ complaintId, sosId, actor, now = new Date() }) {
  const request = await SosRequest.findOne({ complaintId, sosId });
  if (!request) throw new ApiError(404, 'SOS safety request not found.');
  if (request.state === 'cancelled') return request;
  if (request.state !== 'confirmation_pending' || now > request.cancelUntil) {
    throw new ApiError(409, 'The confirmation cancellation window has closed.', {
      code: 'SOS_CANCEL_WINDOW_CLOSED'
    });
  }
  request.transitions.push(transition(
    request.state, 'cancelled', 'cancelled_during_countdown', actor, now
  ));
  request.state = 'cancelled';
  request.cancelledAt = now;
  request.version += 1;
  await request.save();
  await publishRealtimeCaseEvent({
    complaintId, eventName: 'sos:state_changed',
    payload: { sosId, state: 'cancelled', version: request.version }
  });
  return request;
}

function minimizedCurrentLocation(location) {
  if (!location || !Number.isFinite(Number(location.latitude)) ||
      !Number.isFinite(Number(location.longitude))) {
    throw new ApiError(422, 'The one-time location value is invalid.', {
      code: 'SOS_LOCATION_INVALID'
    });
  }
  const latitude = Math.max(-90, Math.min(90, Number(location.latitude)));
  const longitude = Math.max(-180, Math.min(180, Number(location.longitude)));
  return {
    latitude: Math.round(latitude * 100) / 100,
    longitude: Math.round(longitude * 100) / 100,
    capturedAt: new Date().toISOString()
  };
}

export async function activateSos({
  complaintId, sosId, expectedVersion, actor,
  locationConsent = false, locationMode = 'none', location = null,
  now = new Date()
}) {
  const request = await SosRequest.findOne({ complaintId, sosId })
    .select('+locationEncrypted');
  if (!request) throw new ApiError(404, 'SOS safety request not found.');
  if (['created', 'routing_pending', 'routed_internal', 'delivery_unavailable']
    .includes(request.state)) return request;
  if (request.state !== 'confirmation_pending' ||
      request.version !== Number(expectedVersion)) {
    throw new ApiError(409, 'SOS safety request changed. Refresh and try again.', {
      code: 'SOS_VERSION_CONFLICT'
    });
  }
  if (now < request.cancelUntil) {
    throw new ApiError(409, 'The cancellation countdown is still active.', {
      code: 'SOS_CONFIRMATION_COUNTDOWN_ACTIVE'
    });
  }
  if (locationConsent === true && !env.sosLocationEnabled) {
    throw new ApiError(503, 'Location sharing is unavailable.', {
      code: 'SOS_LOCATION_UNAVAILABLE'
    });
  }
  let encrypted = null;
  let mode = 'none';
  if (locationConsent === true && locationMode === 'current_once') {
    encrypted = encryptSensitiveValue(JSON.stringify(minimizedCurrentLocation(location)));
    mode = 'current_once';
  } else if (locationConsent === true && locationMode === 'complaint_approximate') {
    const complaint = await Complaint.findOne({ anonymousId: complaintId })
      .select('+approximateLocationEncrypted').lean();
    if (!complaint?.approximateLocationEncrypted) {
      throw new ApiError(422, 'No consented approximate case location is available.', {
        code: 'SOS_LOCATION_UNAVAILABLE'
      });
    }
    encrypted = complaint.approximateLocationEncrypted;
    mode = 'complaint_approximate';
  }
  request.locationConsent = Boolean(encrypted);
  request.locationMode = mode;
  request.locationConsentVersion = encrypted ? `${env.sosPolicyVersion}:location-v1` : null;
  request.locationEncrypted = encrypted;
  request.locationPrecision = encrypted ? 'approximate' : 'none';
  request.transitions.push(transition(
    request.state, 'created', 'request_persisted', actor, now
  ));
  request.state = 'created';
  request.version += 1;
  request.safeOutcomeCode = 'persisted';
  await request.save();

  if (env.sosInternalRoutingEnabled) {
    request.transitions.push(transition(
      'created', 'routed_internal', 'internal_queue_routed', {
        category: 'system', ref: null
      }, now
    ));
    request.state = 'routed_internal';
    request.internalRoutedAt = now;
    request.safeOutcomeCode = 'internal_queue_only';
  } else {
    request.transitions.push(transition(
      'created', 'delivery_unavailable', 'internal_routing_disabled', {
        category: 'system', ref: null
      }, now
    ));
    request.state = 'delivery_unavailable';
    request.safeFailureCode = 'internal_routing_unavailable';
  }
  request.version += 1;
  await request.save();
  await publishRealtimeCaseEvent({
    complaintId, eventName: 'sos:state_changed',
    payload: { sosId, state: request.state, version: request.version }
  });
  return request;
}

export async function transitionSos({
  complaintId, sosId, expectedVersion, action, actor, now = new Date()
}) {
  const targets = {
    acknowledge: 'acknowledged_by_authorized_staff',
    start_action: 'action_in_progress',
    resolve: 'resolved',
    false_alarm: 'false_alarm_marked',
    close: 'closed'
  };
  const target = targets[action];
  if (!target || !['admin', 'superadmin'].includes(actor.category)) {
    throw new ApiError(403, 'SOS workflow action is not authorized.', {
      code: 'SOS_ACTION_DENIED'
    });
  }
  const request = await SosRequest.findOne({ complaintId, sosId });
  if (!request) throw new ApiError(404, 'SOS safety request not found.');
  if (request.state === target) return request;
  if (request.version !== Number(expectedVersion)) {
    throw new ApiError(409, 'SOS safety request changed. Refresh and try again.', {
      code: 'SOS_VERSION_CONFLICT'
    });
  }
  if (['resolve', 'false_alarm', 'close'].includes(action) &&
      actor.category !== 'superadmin') {
    throw new ApiError(403, 'Closing this safety workflow requires stronger authorization.', {
      code: 'SOS_CRITICAL_CLOSE_DENIED'
    });
  }
  request.transitions.push(transition(
    request.state, target, `staff_${action}`, actor, now
  ));
  request.state = target;
  request.version += 1;
  if (target === 'acknowledged_by_authorized_staff') request.staffAcknowledgedAt = now;
  if (target === 'resolved') request.resolvedAt = now;
  await request.save();
  await publishRealtimeCaseEvent({
    complaintId, eventName: 'sos:state_changed',
    payload: { sosId, state: target, version: request.version }
  });
  return request;
}

export async function readSosLocation({ complaintId, sosId, actor }) {
  if (!['admin', 'superadmin'].includes(actor.category)) {
    throw new ApiError(403, 'SOS location access is not authorized.', {
      code: 'SOS_LOCATION_ACCESS_DENIED'
    });
  }
  const request = await SosRequest.findOne({
    complaintId, sosId, state: { $in: ACTIVE_SOS_STATES },
    locationConsent: true
  }).select('+locationEncrypted').lean();
  if (!request?.locationEncrypted) {
    throw new ApiError(404, 'SOS location is unavailable.');
  }
  return {
    precision: request.locationPrecision,
    location: JSON.parse(decryptSensitiveValue(request.locationEncrypted))
  };
}
