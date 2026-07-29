import assert from 'node:assert/strict';
import http from 'node:http';
import test from 'node:test';
import mongoose from 'mongoose';

const runtimeUri = process.env.MONGODB_URI || '';
const databaseName = runtimeUri.match(/\/([^/?]+)(?:\?|$)/)?.[1] || '';
const runtimeEnabled = /^ss_p(?:[89]|10)_rt_[a-z0-9_]+$/i.test(databaseName);
if (runtimeUri && !runtimeEnabled) {
  throw new Error('Phase 8 runtime test requires a dedicated ss_p8_rt_* database.');
}
process.env.AI_PROCESSING_ENABLED = 'false';
process.env.TRIAGE_AI_ENABLED = 'false';
process.env.ESCALATION_SCHEDULER_ENABLED = 'false';
for (const [key, value] of Object.entries({
  JWT_SECRET: 'p8-jwt-secret-at-least-32-characters',
  REPORTER_ACCESS_HMAC_KEY: 'p8-reporter-hmac-at-least-32-characters',
  REPORTER_TOKEN_SECRET: 'p8-reporter-token-at-least-32-characters',
  STAFF_ACCESS_TOKEN_SECRET: 'p8-staff-access-at-least-32-characters',
  REFRESH_TOKEN_PEPPER: 'p8-refresh-pepper-at-least-32-characters',
  VERIFICATION_TOKEN_PEPPER: 'p8-verification-at-least-32-characters',
  PASSWORD_RESET_TOKEN_PEPPER: 'p8-reset-pepper-at-least-32-characters',
  MFA_CHALLENGE_TOKEN_PEPPER: 'p8-mfa-challenge-at-least-32-characters',
  RECOVERY_CODE_PEPPER: 'p8-recovery-pepper-at-least-32-characters',
  MFA_ENCRYPTION_KEY: 'f'.repeat(64),
  LOCATION_ENCRYPTION_KEY: 'p8-location-at-least-32-characters',
  EVIDENCE_ENCRYPTION_KEY: 'd'.repeat(64)
})) process.env[key] ||= value;

const { default: app } = await import('../../src/app.js');
const { connectDatabase } = await import('../../src/config/db.js');
const { Escalation } = await import('../../src/models/escalation.model.js');
const { WorkflowDeadline } = await import('../../src/models/workflow-deadline.model.js');
const { NGO } = await import('../../src/models/ngo.model.js');
const { NgoAssignment } = await import('../../src/models/ngo-assignment.model.js');
const { User } = await import('../../src/models/user.model.js');
const { Notification } = await import('../../src/models/notification.model.js');
const { createComplaint } = await import('../../src/services/complaint.service.js');
const {
  claimDueDeadline, closeDeadlines, processClaimedDeadline, runSchedulerBatch,
  scheduleDeadline, transitionEscalation
} = await import('../../src/services/escalation-workflow.service.js');
const { reviewAssessment } = await import('../../src/services/triage.service.js');
const { signAccessToken } = await import('../../src/utils/jwt.js');

const criticalInput = {
  dangerHappeningNow: 'yes', immediateThreatToLife: 'yes', weaponInvolved: 'no',
  seriousInjuryPresent: 'no', currentlyConfined: 'no', threatEscalating: 'yes',
  stalkingOrRepeatedContact: 'no', vulnerablePersonAtRisk: 'no',
  urgentMedicalHelpNeeded: 'no', canSafelyContinue: 'yes',
  reporterUrgency: 'urgent', incidentRecency: 'today',
  policyVersion: 'triage-policy-v1', inputSchemaVersion: 'triage-input-v1'
};

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

test('MongoDB-backed Phase 8 deadline, scheduler and escalation lifecycle',
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

    const created = await createComplaint({
      description: 'private phase eight narrative', mediaType: 'none',
      locationConsent: false, approximateLocation: null,
      privacyAcknowledged: true, privacyNoticeVersion: 'privacy-2026-07-v1',
      consentVersion: 'consent-2026-07-v1', aiConsent: false,
      aiDisclosureVersion: null, complaintCategory: 'dowry_harassment',
      preferredLanguage: null, triageInput: criticalInput
    });
    const deadline = await WorkflowDeadline.findOne({
      complaintId: created.complaint.anonymousId,
      deadlineType: 'critical_human_review'
    }).lean();
    assert.ok(deadline);
    assert.equal(deadline.priority, 'critical');
    await scheduleDeadline({
      complaintId: created.complaint.anonymousId,
      type: 'critical_human_review',
      triggerRef: deadline.triggerRef,
      triggeredAt: deadline.createdAt
    });
    assert.equal(await WorkflowDeadline.countDocuments({ activeKey: deadline.activeKey }), 1);

    const controlledNow = new Date(deadline.dueAt.getTime() + 1);
    const beforeDryRun = await WorkflowDeadline.countDocuments();
    const dryRun = await runSchedulerBatch({ now: controlledNow, dryRun: true });
    assert.equal(dryRun.mutationsPerformed, 0);
    assert.equal(await WorkflowDeadline.countDocuments(), beforeDryRun);

    const workerId = 'phase8-atomic-worker';
    const claims = await Promise.all([
      claimDueDeadline({ now: controlledNow, workerId }),
      claimDueDeadline({ now: controlledNow, workerId: 'phase8-other-worker' })
    ]);
    assert.equal(claims.filter(Boolean).length, 1);
    const claimed = claims.find(Boolean);
    await processClaimedDeadline(claimed, { now: controlledNow, workerId: claimed.leaseOwner });
    assert.equal(await Escalation.countDocuments({
      sourceDeadlineId: deadline.deadlineId
    }), 1);
    await runSchedulerBatch({ now: controlledNow, workerId: 'duplicate-run' });
    assert.equal(await Escalation.countDocuments({
      sourceDeadlineId: deadline.deadlineId
    }), 1);

    const stale = await scheduleDeadline({
      complaintId: created.complaint.anonymousId,
      type: 'no_eligible_ngo_review',
      triggerRef: 'routing:test:no-match',
      triggeredAt: new Date(controlledNow.getTime() - 3_600_000)
    });
    await WorkflowDeadline.updateOne({ _id: stale._id }, {
      dueAt: new Date(controlledNow.getTime() - 10_000),
      leaseOwner: 'dead-worker',
      leaseUntil: new Date(controlledNow.getTime() - 1_000)
    });
    const recovered = await claimDueDeadline({
      now: controlledNow, workerId: 'recovery-worker'
    });
    assert.equal(recovered.deadlineId, stale.deadlineId);
    await processClaimedDeadline(recovered, {
      now: controlledNow, workerId: 'recovery-worker'
    });

    const ngo = await NGO.create({
      name: 'Phase 8 NGO', email: 'p8-ngo-profile@test.invalid',
      verificationStatus: 'approved', profileVersion: 1, approvedProfileVersion: 1,
      operationalStatus: 'active', acceptsNewAssignments: true,
      maximumActiveAssignments: 2, currentActiveAssignments: 1,
      supportedCategories: ['dowry_harassment'], remoteSupport: true
    });
    const assignment = await NgoAssignment.create({
      complaintId: created.complaint.anonymousId, ngoPublicId: ngo.publicId,
      state: 'offered', source: 'manual', routingPolicyVersion: 'ngo-routing-v1',
      offeredAt: new Date(controlledNow.getTime() - 60_000),
      expiresAt: new Date(controlledNow.getTime() - 1_000)
    });
    const offerDeadline = await scheduleDeadline({
      complaintId: created.complaint.anonymousId,
      type: 'ngo_offer_response', triggerRef: assignment.assignmentId,
      dueAt: assignment.expiresAt
    });
    await runSchedulerBatch({ now: controlledNow, workerId: 'offer-worker' });
    await runSchedulerBatch({ now: controlledNow, workerId: 'offer-worker-repeat' });
    assert.equal((await NGO.findById(ngo._id).lean()).currentActiveAssignments, 0);
    assert.equal((await NgoAssignment.findById(assignment._id).lean()).state, 'expired');
    assert.equal(await Escalation.countDocuments({
      sourceDeadlineId: offerDeadline.deadlineId
    }), 1);

    const assessment = await import('../../src/models/triage-assessment.model.js')
      .then(({ TriageAssessment }) => TriageAssessment.findOne({
        complaintId: created.complaint.anonymousId, isCurrent: true
      }).lean());
    const [admin, superadmin, ngoUser] = await User.create([
      { name: 'Admin', email: 'p8-admin@test.invalid', passwordHash: 'x',
        role: 'admin', isVerified: true },
      { name: 'Super', email: 'p8-super@test.invalid', passwordHash: 'x',
        role: 'superadmin', isVerified: true },
      { name: 'NGO User', email: 'p8-ngo@test.invalid', passwordHash: 'x',
        role: 'ngo', isVerified: true }
    ]);
    await reviewAssessment({
      complaintId: created.complaint.anonymousId,
      expectedAssessmentId: assessment.assessmentId,
      expectedVersion: assessment.version,
      action: 'confirm', actor: { id: superadmin.id, role: 'superadmin' }
    });
    assert.equal(await WorkflowDeadline.countDocuments({
      triggerRef: assessment.assessmentId,
      status: { $in: ['scheduled', 'due', 'overdue'] }
    }), 0);

    const criticalEscalation = await Escalation.findOne({
      sourceDeadlineId: deadline.deadlineId
    }).lean();
    await assert.rejects(() => transitionEscalation({
      escalationId: criticalEscalation.escalationId,
      expectedVersion: criticalEscalation.version,
      action: 'resolve', reasonCategory: 'workflow_completed',
      actor: { id: admin.id, role: 'admin' }
    }), (error) => error.statusCode === 403);

    const ngoToken = signAccessToken({ subject: ngoUser.id, role: 'ngo' });
    const denied = await api(baseUrl,
      `/dashboard/workflow/escalations/${criticalEscalation.escalationId}/actions`, {
        method: 'POST', token: ngoToken,
        body: { version: criticalEscalation.version, action: 'acknowledge',
          reasonCategory: 'review_started' }
      });
    assert.equal(denied.response.status, 403);

    const resolved = await transitionEscalation({
      escalationId: criticalEscalation.escalationId,
      expectedVersion: criticalEscalation.version,
      action: 'resolve', reasonCategory: 'workflow_completed',
      note: 'Bounded private operational note.',
      actor: { id: superadmin.id, role: 'superadmin' }
    });
    assert.equal(resolved.status, 'resolved');
    assert.equal(resolved.transitions.length, 2);

    const exchange = await api(baseUrl, '/complaints/reporter-access/token', {
      method: 'POST', body: {
        caseId: created.complaint.anonymousId,
        accessSecret: created.accessSecret
      }
    });
    const reporter = await api(baseUrl,
      `/complaints/lookup/${created.complaint.anonymousId}/triage`, {
        token: exchange.payload.data.accessToken
      });
    const reporterJson = JSON.stringify(reporter.payload);
    assert.equal(reporter.response.status, 200);
    assert.match(reporter.payload.data.triage.workflowNotice, /not a guaranteed response time/i);
    assert.doesNotMatch(reporterJson, /dueAt|attemptCount|reasonCodes|private operational/i);

    assert.equal(await Notification.countDocuments(), 0);
    const databaseJson = JSON.stringify({
      deadlines: await WorkflowDeadline.find({}).lean(),
      escalations: await Escalation.find({}).lean()
    });
    for (const forbidden of [
      'private phase eight narrative', 'accessSecret', 'reporterToken',
      'police_notified', 'ambulance_notified', 'sos_created'
    ]) assert.equal(databaseJson.includes(forbidden), false);

    await closeDeadlines({
      complaintId: created.complaint.anonymousId,
      status: 'cancelled', outcomeCode: 'runtime_cleanup'
    });
  });
