import assert from 'node:assert/strict';
import http from 'node:http';
import test from 'node:test';
import mongoose from 'mongoose';

const runtimeUri = process.env.MONGODB_URI || '';
const databaseName = runtimeUri.match(/\/([^/?]+)(?:\?|$)/)?.[1] || '';
const runtimeEnabled = /^ss_p10_rt_[a-z0-9_]+$/i.test(databaseName);
if (runtimeUri && !runtimeEnabled) {
  throw new Error('Phase 10 runtime test requires a dedicated ss_p10_rt_* database.');
}
process.env.NODE_ENV = 'test';
process.env.AI_PROCESSING_ENABLED = 'false';
process.env.TRIAGE_AI_ENABLED = 'false';
process.env.ESCALATION_SCHEDULER_ENABLED = 'false';
process.env.SOCKET_IO_ENABLED = 'false';
process.env.SOS_ENABLED = 'true';
process.env.SOS_CONFIRMATION_SECONDS = '1';
process.env.SOS_ACTIVE_EXPIRY_MINUTES = '5';
process.env.SOS_LOCATION_ENABLED = 'true';
process.env.SOS_INTERNAL_ROUTING_ENABLED = 'true';
process.env.SOS_EXTERNAL_DELIVERY_ENABLED = 'false';
for (const [key, value] of Object.entries({
  JWT_SECRET: 'p10-jwt-secret-at-least-32-characters',
  REPORTER_ACCESS_HMAC_KEY: 'p10-reporter-hmac-at-least-32-characters',
  REPORTER_TOKEN_SECRET: 'p10-reporter-token-at-least-32-characters',
  STAFF_ACCESS_TOKEN_SECRET: 'p10-staff-access-at-least-32-characters',
  REFRESH_TOKEN_PEPPER: 'p10-refresh-pepper-at-least-32-characters',
  VERIFICATION_TOKEN_PEPPER: 'p10-verification-at-least-32-characters',
  PASSWORD_RESET_TOKEN_PEPPER: 'p10-reset-pepper-at-least-32-characters',
  MFA_CHALLENGE_TOKEN_PEPPER: 'p10-mfa-challenge-at-least-32-characters',
  RECOVERY_CODE_PEPPER: 'p10-recovery-pepper-at-least-32-characters',
  MFA_ENCRYPTION_KEY: 'f'.repeat(64),
  LOCATION_ENCRYPTION_KEY: 'p10-location-at-least-32-characters',
  EVIDENCE_ENCRYPTION_KEY: 'd'.repeat(64)
})) process.env[key] ||= value;

const { default: app } = await import('../../src/app.js');
const { connectDatabase } = await import('../../src/config/db.js');
const { AuditLog } = await import('../../src/models/audit-log.model.js');
const { HelplineEntry } = await import('../../src/models/helpline-entry.model.js');
const { NGO } = await import('../../src/models/ngo.model.js');
const { NgoAssignment } = await import('../../src/models/ngo-assignment.model.js');
const { SosRequest } = await import('../../src/models/sos-request.model.js');
const { User } = await import('../../src/models/user.model.js');
const { createComplaint } = await import('../../src/services/complaint.service.js');
const {
  createHelplineDraft, listVerifiedHelplines, reviewHelpline
} = await import('../../src/services/helpline.service.js');
const { setLogSink, resetLogSink } = await import('../../src/services/logger.service.js');
const {
  registerRealtimePublishHandler
} = await import('../../src/services/realtime-revocation.service.js');
const {
  activateSos, cancelSos, readSosLocation, serializeSos,
  sosExternalDeliveryMetrics, startSosConfirmation, transitionSos
} = await import('../../src/services/sos.service.js');
const { signAccessToken } = await import('../../src/utils/jwt.js');
const { signReporterCaseToken } = await import('../../src/utils/reporter-access.js');

const input = {
  dangerHappeningNow: 'yes', immediateThreatToLife: 'yes', weaponInvolved: 'no',
  seriousInjuryPresent: 'no', currentlyConfined: 'no', threatEscalating: 'yes',
  stalkingOrRepeatedContact: 'no', vulnerablePersonAtRisk: 'no',
  urgentMedicalHelpNeeded: 'no', canSafelyContinue: 'yes',
  reporterUrgency: 'urgent', incidentRecency: 'today',
  policyVersion: 'triage-policy-v1', inputSchemaVersion: 'triage-input-v1'
};
const createCase = (name) => createComplaint({
  description: `private SOS narrative ${name}`, mediaType: 'none',
  locationConsent: false, approximateLocation: null,
  privacyAcknowledged: true, privacyNoticeVersion: 'privacy-2026-07-v1',
  consentVersion: 'consent-2026-07-v1', aiConsent: false,
  aiDisclosureVersion: null, complaintCategory: 'dowry_harassment',
  preferredLanguage: null, triageInput: input
});
const actorFor = (caseId) => ({
  category: 'reporter', reporter: true, ref: `reporter-ref-${caseId}`
});

async function api(baseUrl, path, { method = 'GET', token, body } = {}) {
  const response = await fetch(`${baseUrl}/api/v1${path}`, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
  return { response, payload: await response.json() };
}

test('MongoDB-backed Phase 10 SOS and verified helpline lifecycle',
  { skip: !runtimeEnabled }, async (t) => {
    await connectDatabase();
    await mongoose.connection.dropDatabase();
    const server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const baseUrl = `http://127.0.0.1:${server.address().port}`;
    const logEntries = [];
    setLogSink((entry) => logEntries.push(entry));
    t.after(async () => {
      resetLogSink();
      registerRealtimePublishHandler(async () => {});
      await mongoose.connection.dropDatabase();
      await mongoose.disconnect();
      await new Promise((resolve) => server.close(resolve));
    });

    const [caseA, caseB] = await Promise.all([createCase('A'), createCase('B')]);
    const at = new Date('2026-07-29T08:00:00.000Z');
    await assert.rejects(() => startSosConfirmation({
      complaintId: caseA.complaint.anonymousId,
      actor: actorFor(caseA.complaint.anonymousId),
      acknowledgedNonDispatch: false, idempotencyKey: 'explicit-fail-01', now: at
    }), (error) => error.code === 'SOS_CONFIRMATION_REQUIRED');

    const first = await startSosConfirmation({
      complaintId: caseA.complaint.anonymousId,
      actor: actorFor(caseA.complaint.anonymousId),
      acknowledgedNonDispatch: true, idempotencyKey: 'cancel-flow-001', now: at
    });
    assert.equal(first.request.locationConsent, false);
    const cancelled = await cancelSos({
      complaintId: caseA.complaint.anonymousId,
      sosId: first.request.sosId,
      actor: actorFor(caseA.complaint.anonymousId),
      now: new Date(at.getTime() + 500)
    });
    assert.equal(cancelled.state, 'cancelled');

    const secondStartAt = new Date(at.getTime() + 2_000);
    const second = await startSosConfirmation({
      complaintId: caseA.complaint.anonymousId,
      actor: actorFor(caseA.complaint.anonymousId),
      acknowledgedNonDispatch: true, idempotencyKey: 'active-flow-001',
      now: secondStartAt
    });
    const duplicate = await startSosConfirmation({
      complaintId: caseA.complaint.anonymousId,
      actor: actorFor(caseA.complaint.anonymousId),
      acknowledgedNonDispatch: true, idempotencyKey: 'active-flow-other',
      now: secondStartAt
    });
    assert.equal(duplicate.duplicate, true);
    assert.equal(duplicate.request.sosId, second.request.sosId);

    let persistedBeforeBroadcast = false;
    registerRealtimePublishHandler(async ({ complaintId, payload }) => {
      const stored = await SosRequest.findOne({
        complaintId, sosId: payload.sosId
      }).lean();
      persistedBeforeBroadcast = stored?.state === payload.state;
    });
    const activated = await activateSos({
      complaintId: caseA.complaint.anonymousId,
      sosId: second.request.sosId,
      expectedVersion: second.request.version,
      actor: actorFor(caseA.complaint.anonymousId),
      locationConsent: false,
      now: new Date(second.request.cancelUntil.getTime() + 1)
    });
    assert.equal(activated.state, 'routed_internal');
    assert.equal(activated.locationConsent, false);
    assert.equal(persistedBeforeBroadcast, true);
    assert.equal(sosExternalDeliveryMetrics.invocationCount, 0);

    const third = await startSosConfirmation({
      complaintId: caseB.complaint.anonymousId,
      actor: actorFor(caseB.complaint.anonymousId),
      acknowledgedNonDispatch: true, idempotencyKey: 'location-flow-001',
      now: at
    });
    const located = await activateSos({
      complaintId: caseB.complaint.anonymousId,
      sosId: third.request.sosId,
      expectedVersion: third.request.version,
      actor: actorFor(caseB.complaint.anonymousId),
      locationConsent: true, locationMode: 'current_once',
      location: { latitude: 28.613939, longitude: 77.209021 },
      now: new Date(third.request.cancelUntil.getTime() + 1)
    });
    const general = serializeSos(located);
    assert.equal(general.locationShared, true);
    assert.equal(JSON.stringify(general).includes('28.61'), false);

    const [admin, superadmin, ngoUser] = await User.create([
      { name: 'SOS admin', email: 'p10-admin@test.invalid', passwordHash: 'x',
        role: 'admin', isVerified: true },
      { name: 'SOS super', email: 'p10-super@test.invalid', passwordHash: 'x',
        role: 'superadmin', isVerified: true },
      { name: 'SOS NGO', email: 'p10-ngo@test.invalid', passwordHash: 'x',
        role: 'ngo', isVerified: true }
    ]);
    const adminActor = { category: 'admin', ref: 'admin-ref' };
    const superActor = { category: 'superadmin', ref: 'super-ref' };
    const precise = await readSosLocation({
      complaintId: caseB.complaint.anonymousId,
      sosId: located.sosId, actor: adminActor
    });
    assert.equal(precise.precision, 'approximate');
    assert.equal(precise.location.latitude, 28.61);
    await assert.rejects(() => readSosLocation({
      complaintId: caseB.complaint.anonymousId,
      sosId: located.sosId,
      actor: { category: 'ngo', ref: 'ngo-ref' }
    }), (error) => error.code === 'SOS_LOCATION_ACCESS_DENIED');

    const acknowledged = await transitionSos({
      complaintId: caseA.complaint.anonymousId,
      sosId: activated.sosId, expectedVersion: activated.version,
      action: 'acknowledge', actor: adminActor
    });
    assert.equal(acknowledged.state, 'acknowledged_by_authorized_staff');
    await assert.rejects(() => transitionSos({
      complaintId: caseA.complaint.anonymousId,
      sosId: acknowledged.sosId, expectedVersion: acknowledged.version,
      action: 'resolve', actor: adminActor
    }), (error) => error.code === 'SOS_CRITICAL_CLOSE_DENIED');
    const resolved = await transitionSos({
      complaintId: caseA.complaint.anonymousId,
      sosId: acknowledged.sosId, expectedVersion: acknowledged.version,
      action: 'resolve', actor: superActor
    });
    assert.equal(resolved.state, 'resolved');

    const reporterA = signReporterCaseToken(caseA.complaint.anonymousId);
    const reporterB = signReporterCaseToken(caseB.complaint.anonymousId);
    const own = await api(baseUrl,
      `/complaints/lookup/${caseA.complaint.anonymousId}/sos`,
      { token: reporterA });
    assert.equal(own.response.status, 200);
    const cross = await api(baseUrl,
      `/complaints/lookup/${caseB.complaint.anonymousId}/sos`,
      { token: reporterA });
    assert.equal(cross.response.status, 403);
    const limitedAttempts = [];
    for (let attempt = 0; attempt < 6; attempt += 1) {
      limitedAttempts.push(await api(baseUrl,
        `/complaints/lookup/${caseA.complaint.anonymousId}/sos/confirmations`, {
          method: 'POST', token: reporterA,
          body: {
            acknowledgedNonDispatch: true,
            idempotencyKey: `rate-limit-${attempt}`
          }
        }));
    }
    assert.equal(limitedAttempts.slice(0, 5).every(({ response }) =>
      response.status >= 200 && response.status < 300), true);
    assert.equal(limitedAttempts[5].response.status, 429);

    const ngo = await NGO.create({
      userId: ngoUser.id, name: 'SOS NGO profile',
      email: 'p10-ngo-profile@test.invalid',
      verificationStatus: 'approved', profileVersion: 1, approvedProfileVersion: 1,
      operationalStatus: 'active', acceptsNewAssignments: true,
      supportedCategories: ['dowry_harassment'], remoteSupport: true
    });
    const assignment = await NgoAssignment.create({
      complaintId: caseB.complaint.anonymousId, ngoPublicId: ngo.publicId,
      state: 'acknowledged', isCurrent: true, source: 'manual',
      routingPolicyVersion: 'ngo-routing-v1', acknowledgedAt: new Date()
    });
    const ngoToken = signAccessToken({ subject: ngoUser.id, role: 'ngo' });
    const ngoAllowed = await api(baseUrl,
      `/complaints/lookup/${caseB.complaint.anonymousId}/sos`, { token: ngoToken });
    assert.equal(ngoAllowed.response.status, 200);
    await NgoAssignment.updateOne({ _id: assignment._id }, {
      state: 'withdrawn', isCurrent: false, withdrawnAt: new Date()
    });
    const ngoRevoked = await api(baseUrl,
      `/complaints/lookup/${caseB.complaint.anonymousId}/sos`, { token: ngoToken });
    assert.equal(ngoRevoked.response.status, 403);

    const fixtureInput = {
      country: 'xx', region: 'test-region', serviceCategory: 'other',
      displayName: 'Reserved Test Helpline', contactMethod: 'phone',
      contactValue: '+999 000 000', availabilityWording: 'Test fixture hours only',
      languages: ['test-language'], sourceAuthority: 'Phase 10 test authority',
      sourceReference: 'https://example.invalid/official-test-source',
      sourceVerifiedAt: at, reverifyAt: new Date(at.getTime() + 30 * 86400000),
      geographicApplicability: 'Reserved test region only',
      safeDisclaimer: 'Fake reserved test fixture; no calls are made.',
      testFixture: true
    };
    const draft = await createHelplineDraft(fixtureInput, admin);
    const verified = await reviewHelpline({
      helplineId: draft.helplineId, expectedVersion: 1,
      action: 'verify', actor: admin, now: at
    });
    await HelplineEntry.create({
      ...fixtureInput, contactValue: '+999 000 001',
      displayName: 'Expired Test Entry',
      directoryVersion: 'helpline-directory-v1',
      reviewStatus: 'verified', active: true,
      lastReviewedAt: new Date(at.getTime() - 400 * 86400000),
      reverifyAt: new Date(at.getTime() - 1), reviewVersion: 1
    });
    await createHelplineDraft({
      ...fixtureInput, contactValue: '+999 000 002',
      displayName: 'Unreviewed Test Entry'
    }, admin);
    const listed = await listVerifiedHelplines({
      country: 'xx', region: 'test-region', now: at
    });
    assert.deepEqual(listed.map((item) => item.helplineId), [verified.helplineId]);

    const rawSos = JSON.stringify(await SosRequest.find({}).lean());
    const rawAudit = JSON.stringify(await AuditLog.find({}).lean());
    const rawLogs = JSON.stringify(logEntries);
    for (const raw of [rawSos, rawAudit, rawLogs]) {
      assert.equal(raw.includes('28.61'), false);
      assert.equal(raw.includes('77.21'), false);
      assert.equal(raw.includes(reporterA), false);
      assert.equal(raw.includes('private SOS narrative'), false);
    }
    assert.equal(sosExternalDeliveryMetrics.invocationCount, 0);
  });
