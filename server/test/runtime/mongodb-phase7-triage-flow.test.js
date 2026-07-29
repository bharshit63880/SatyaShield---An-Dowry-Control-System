import assert from 'node:assert/strict';
import http from 'node:http';
import test from 'node:test';
import mongoose from 'mongoose';

const runtimeUri = process.env.MONGODB_URI || '';
const databaseName = runtimeUri.match(/\/([^/?]+)(?:\?|$)/)?.[1] || '';
const runtimeEnabled = /^ss_p(?:[789]|10)_rt_[a-z0-9_]+$/i.test(databaseName);
if (runtimeUri && !runtimeEnabled) throw new Error(
  'Runtime test refused: MONGODB_URI must target a dedicated Phase 7 test database.'
);
process.env.AI_PROCESSING_ENABLED = 'false';
process.env.TRIAGE_AI_ENABLED = 'false';
for (const [key, value] of Object.entries({
  JWT_SECRET: 'p7-jwt-secret-at-least-32-characters',
  REPORTER_ACCESS_HMAC_KEY: 'p7-reporter-hmac-at-least-32-characters',
  REPORTER_TOKEN_SECRET: 'p7-reporter-token-at-least-32-characters',
  STAFF_ACCESS_TOKEN_SECRET: 'p7-staff-access-at-least-32-characters',
  REFRESH_TOKEN_PEPPER: 'p7-refresh-pepper-at-least-32-characters',
  VERIFICATION_TOKEN_PEPPER: 'p7-verification-at-least-32-characters',
  PASSWORD_RESET_TOKEN_PEPPER: 'p7-reset-pepper-at-least-32-characters',
  MFA_CHALLENGE_TOKEN_PEPPER: 'p7-mfa-challenge-at-least-32-characters',
  RECOVERY_CODE_PEPPER: 'p7-recovery-pepper-at-least-32-characters',
  MFA_ENCRYPTION_KEY: 'f'.repeat(64),
  LOCATION_ENCRYPTION_KEY: 'p7-location-at-least-32-characters',
  EVIDENCE_ENCRYPTION_KEY: 'd'.repeat(64)
})) process.env[key] ||= value;

const { default: app } = await import('../../src/app.js');
const { connectDatabase } = await import('../../src/config/db.js');
const { Complaint } = await import('../../src/models/complaint.model.js');
const { TriageAssessment } = await import('../../src/models/triage-assessment.model.js');
const { Escalation } = await import('../../src/models/escalation.model.js');
const { User } = await import('../../src/models/user.model.js');
const { NGO } = await import('../../src/models/ngo.model.js');
const { NgoAssignment } = await import('../../src/models/ngo-assignment.model.js');
const { Investigator } = await import('../../src/models/investigator.model.js');
const { createComplaint } = await import('../../src/services/complaint.service.js');
const { reviewAssessment } = await import('../../src/services/triage.service.js');
const { runLocalAdvisoryTestDouble } =
  await import('../../src/services/triage-ai-boundary.service.js');
const { signAccessToken } = await import('../../src/utils/jwt.js');

const baseInput = {
  dangerHappeningNow: 'no', immediateThreatToLife: 'no', weaponInvolved: 'no',
  seriousInjuryPresent: 'no', currentlyConfined: 'no', threatEscalating: 'no',
  stalkingOrRepeatedContact: 'no', vulnerablePersonAtRisk: 'no',
  urgentMedicalHelpNeeded: 'no', canSafelyContinue: 'yes',
  reporterUrgency: 'routine', incidentRecency: 'historical',
  policyVersion: 'triage-policy-v1', inputSchemaVersion: 'triage-input-v1'
};
const create = (description, triageInput) => createComplaint({
  description, mediaType: 'none', locationConsent: false, approximateLocation: null,
  privacyAcknowledged: true, privacyNoticeVersion: 'privacy-2026-07-v1',
  consentVersion: 'consent-2026-07-v1', aiConsent: false, aiDisclosureVersion: null,
  complaintCategory: 'dowry_harassment', preferredLanguage: null, triageInput
});

async function api(baseUrl, path, { method = 'GET', token, body } = {}) {
  const response = await fetch(`${baseUrl}/api/v1${path}`, {
    method, headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {})
    }, body: body ? JSON.stringify(body) : undefined
  });
  return { response, payload: await response.json() };
}

test('MongoDB-backed Phase 7 deterministic triage and human-review lifecycle',
  { skip: !runtimeEnabled }, async (t) => {
    await connectDatabase();
    await mongoose.connection.dropDatabase();
    const server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const baseUrl = `http://127.0.0.1:${server.address().port}`;
    t.after(async () => {
      await mongoose.connection.dropDatabase();
      await mongoose.disconnect();
      await new Promise((resolve) => server.close(resolve));
    });

    const scenarios = [
      ['low', baseInput],
      ['moderate', { ...baseInput, reporterUrgency: 'concerned' }],
      ['high', { ...baseInput, threatEscalating: 'yes' }],
      ['critical', { ...baseInput, immediateThreatToLife: 'yes' }],
      ['conflict', { ...baseInput, immediateThreatToLife: 'yes', dangerHappeningNow: 'no' }],
      ['unknown', { ...baseInput, dangerHappeningNow: 'unknown', immediateThreatToLife: 'unknown',
        weaponInvolved: 'unknown', seriousInjuryPresent: 'unknown', currentlyConfined: 'unknown' }]
    ];
    const created = {};
    for (const [name, input] of scenarios) {
      created[name] = await create(`private narrative ${name}`, input);
    }
    const assessments = Object.fromEntries(await Promise.all(
      Object.entries(created).map(async ([name, value]) => [name,
        await TriageAssessment.findOne({ complaintId: value.complaint.anonymousId, isCurrent: true }).lean()])
    ));
    assert.equal(assessments.low.severity, 'low');
    assert.equal(assessments.moderate.severity, 'moderate');
    assert.equal(assessments.high.severity, 'high');
    assert.equal(assessments.critical.severity, 'critical');
    assert.equal(assessments.critical.reviewState, 'review_required');
    assert.equal(assessments.conflict.uncertaintyState, 'conflicting');
    assert.equal(assessments.unknown.reviewState, 'review_required');
    assert.equal(await Escalation.countDocuments(), 0);
    assert.equal(await NgoAssignment.countDocuments(), 0);

    const exchange = await api(baseUrl, '/complaints/reporter-access/token', {
      method: 'POST', body: {
        caseId: created.critical.complaint.anonymousId,
        accessSecret: created.critical.accessSecret
      }
    });
    const reporterToken = exchange.payload.data.accessToken;
    const reporterView = await api(baseUrl,
      `/complaints/lookup/${created.critical.complaint.anonymousId}/triage`,
      { token: reporterToken });
    assert.equal(reporterView.response.status, 200);
    assert.equal(reporterView.payload.data.triage.severity, 'critical');
    assert.match(reporterView.payload.data.triage.safetyGuidance, /does not automatically contact/i);
    assert.equal(JSON.stringify(reporterView.payload).includes('indicatorCodes'), false);
    const crossCase = await api(baseUrl,
      `/complaints/lookup/${created.low.complaint.anonymousId}/triage`,
      { token: reporterToken });
    assert.equal(crossCase.response.status, 403);

    const [admin, superadmin, ngoUser, invUser] = await User.create([
      { name: 'Admin', email: 'p7-admin@test.invalid', passwordHash: 'x', role: 'admin', isVerified: true },
      { name: 'Super', email: 'p7-super@test.invalid', passwordHash: 'x', role: 'superadmin', isVerified: true },
      { name: 'NGO', email: 'p7-ngo@test.invalid', passwordHash: 'x', role: 'ngo', isVerified: true },
      { name: 'Inv', email: 'p7-inv@test.invalid', passwordHash: 'x', role: 'investigator', isVerified: true }
    ]);
    const adminToken = signAccessToken({ subject: admin.id, role: 'admin' });
    const ngoToken = signAccessToken({ subject: ngoUser.id, role: 'ngo' });
    const investigatorToken = signAccessToken({ subject: invUser.id, role: 'investigator' });
    await NGO.create({
      userId: ngoUser.id, name: 'P7 NGO', email: 'p7-ngo-profile@test.invalid',
      verificationStatus: 'approved', profileVersion: 1, approvedProfileVersion: 1,
      operationalStatus: 'active', acceptsNewAssignments: true,
      supportedCategories: ['dowry_harassment'], remoteSupport: true
    });
    const ngo = await NGO.findOne({ userId: ngoUser.id });
    await NgoAssignment.create({
      complaintId: created.high.complaint.anonymousId, ngoPublicId: ngo.publicId,
      state: 'acknowledged', source: 'manual', routingPolicyVersion: 'ngo-routing-v1',
      acknowledgedAt: new Date()
    });
    await Investigator.create({
      userId: invUser.id, name: 'P7 investigator', badgeNumber: 'P7-I',
      agency: 'Test', phone: 'x', isActive: true, isEligible: true
    });
    await Complaint.updateOne({ anonymousId: created.high.complaint.anonymousId }, {
      assignedInvestigator: { investigatorId: invUser.id, name: 'P7 investigator' }
    });
    const ngoView = await api(baseUrl,
      `/complaints/lookup/${created.high.complaint.anonymousId}/triage`, { token: ngoToken });
    assert.equal(ngoView.response.status, 200);
    assert.ok(ngoView.payload.data.triage.indicatorCodes.includes('escalating_threat'));
    const investigatorView = await api(baseUrl,
      `/complaints/lookup/${created.high.complaint.anonymousId}/triage`,
      { token: investigatorToken });
    assert.equal(investigatorView.response.status, 200);
    assert.ok(investigatorView.payload.data.triage.indicatorCodes.includes('escalating_threat'));
    const investigatorCrossCase = await api(baseUrl,
      `/complaints/lookup/${created.low.complaint.anonymousId}/triage`,
      { token: investigatorToken });
    assert.equal(investigatorCrossCase.response.status, 403);
    const unauthorized = await api(baseUrl,
      `/dashboard/complaints/${created.high.complaint.anonymousId}/triage/review`, {
        method: 'POST', token: ngoToken, body: {}
      });
    assert.equal(unauthorized.response.status, 403);

    const confirmed = await reviewAssessment({
      complaintId: created.high.complaint.anonymousId,
      expectedAssessmentId: assessments.high.assessmentId, expectedVersion: 1,
      action: 'confirm', actor: { id: admin.id, role: 'admin' }
    });
    assert.equal(confirmed.version, 2);
    const original = await TriageAssessment.findOne({ assessmentId: assessments.high.assessmentId }).lean();
    assert.equal(original.severity, 'high');
    const override = await reviewAssessment({
      complaintId: created.high.complaint.anonymousId,
      expectedAssessmentId: confirmed.assessmentId, expectedVersion: 2,
      action: 'override', severity: 'critical', overrideCategory: 'new_information',
      note: 'Bounded runtime review note.', actor: { id: admin.id, role: 'admin' }
    });
    assert.equal(override.version, 3);
    await assert.rejects(() => reviewAssessment({
      complaintId: created.high.complaint.anonymousId,
      expectedAssessmentId: confirmed.assessmentId, expectedVersion: 2,
      action: 'confirm', actor: { id: admin.id, role: 'admin' }
    }), (error) => error.statusCode === 409);

    await assert.rejects(() => reviewAssessment({
      complaintId: created.critical.complaint.anonymousId,
      expectedAssessmentId: assessments.critical.assessmentId, expectedVersion: 1,
      action: 'override', severity: 'high', overrideCategory: 'incorrect_structured_input',
      note: 'Admin downgrade must be refused.', actor: { id: admin.id, role: 'admin' }
    }), (error) => error.statusCode === 403);
    const superadminDowngrade = await reviewAssessment({
      complaintId: created.critical.complaint.anonymousId,
      expectedAssessmentId: assessments.critical.assessmentId, expectedVersion: 1,
      action: 'override', severity: 'high', overrideCategory: 'incorrect_structured_input',
      note: 'Superadmin-authorized critical downgrade for the isolated runtime test.',
      actor: { id: superadmin.id, role: 'superadmin' }
    });
    assert.equal(superadminDowngrade.severity, 'high');

    await NgoAssignment.updateOne(
      { complaintId: created.high.complaint.anonymousId, isCurrent: true },
      { state: 'withdrawn', isCurrent: false, withdrawnAt: new Date() }
    );
    const revoked = await api(baseUrl,
      `/complaints/lookup/${created.high.complaint.anonymousId}/triage`, { token: ngoToken });
    assert.equal(revoked.response.status, 403);

    let minimized;
    const advisory = await runLocalAdvisoryTestDouble({
      assessment: assessments.critical,
      consent: { explicit: true, disclosureVersion: 'test-only-disclosure' },
      adapter: async (payload) => {
        minimized = payload;
        return { suggestedSeverity: 'critical', advisoryCodes: ['human_review'] };
      }
    });
    assert.equal(advisory.used, true);
    assert.deepEqual(Object.keys(minimized).sort(),
      ['indicatorCodes', 'policyVersion', 'severity', 'uncertaintyState'].sort());

    const queue = await api(baseUrl, '/dashboard/triage/queue', { token: adminToken });
    assert.equal(queue.response.status, 200);
    assert.equal(queue.payload.data.assessments[0].severity, 'critical');
    const reporterQueue = await api(baseUrl, '/dashboard/triage/queue', { token: reporterToken });
    assert.equal(reporterQueue.response.status, 401);

    const dbJson = JSON.stringify(await TriageAssessment.find({}).lean());
    for (const forbidden of [
      'private narrative', 'reporterAccessSecret', 'descriptionEncrypted',
      'storageId', 'reviewerToken', 'user-agent'
    ]) assert.equal(dbJson.includes(forbidden), false);
  });
