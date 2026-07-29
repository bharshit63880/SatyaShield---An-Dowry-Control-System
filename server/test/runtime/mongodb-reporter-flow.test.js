import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import test from 'node:test';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';

const runtimeUri = process.env.MONGODB_URI ?? '';
const databaseName = runtimeUri.match(/\/([^/?]+)(?:\?|$)/)?.[1] ?? '';
const runtimeEnabled = /^ss_p(?:[145789]|10)_rt_[a-z0-9_]+$/i.test(databaseName);
process.env.EVIDENCE_ENCRYPTION_KEY ||= 'c'.repeat(64);
process.env.STAFF_ACCESS_TOKEN_SECRET ||= 'runtime-staff-access-secret-at-least-32-characters';
process.env.REFRESH_TOKEN_PEPPER ||= 'runtime-refresh-token-pepper-at-least-32-characters';
process.env.VERIFICATION_TOKEN_PEPPER ||= 'runtime-verification-pepper-at-least-32-characters';
process.env.PASSWORD_RESET_TOKEN_PEPPER ||= 'runtime-reset-pepper-at-least-32-characters';
process.env.MFA_CHALLENGE_TOKEN_PEPPER ||= 'runtime-mfa-challenge-pepper-at-least-32-characters';
process.env.RECOVERY_CODE_PEPPER ||= 'runtime-recovery-code-pepper-at-least-32-characters';
process.env.MFA_ENCRYPTION_KEY ||= 'f'.repeat(64);
if (
  runtimeUri &&
  !runtimeEnabled &&
  !/^ss_p[23457]_rt_[a-z0-9_]+$/i.test(databaseName)
) {
  throw new Error('Runtime test refused: MONGODB_URI must target a dedicated Phase 1 test database.');
}

const { default: app } = await import('../../src/app.js');
const { Complaint } = await import('../../src/models/complaint.model.js');
const { User } = await import('../../src/models/user.model.js');
const { connectDatabase } = await import('../../src/config/db.js');
const { env } = await import('../../src/config/env.js');
const { verifyReporterCaseToken } = await import('../../src/utils/reporter-access.js');
const { privateEvidenceDirectory } = await import('../../src/config/paths.js');
const { buildRetentionDryRunReport } = await import('../../src/services/retention.service.js');

async function api(baseUrl, path, { method = 'GET', token, body, formData } = {}) {
  const response = await fetch(`${baseUrl}/api/v1${path}`, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {})
    },
    body: formData ?? (body ? JSON.stringify(body) : undefined)
  });
  const payload = await response.json();
  return { response, payload };
}

test('MongoDB-backed reporter submission-to-tracking flow', { skip: !runtimeEnabled }, async (t) => {
  await connectDatabase();
  await mongoose.connection.dropDatabase();
  await fs.rm(privateEvidenceDirectory, { recursive: true, force: true });

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;

  t.after(async () => {
    await mongoose.connection.dropDatabase();
    await fs.rm(privateEvidenceDirectory, { recursive: true, force: true });
    await mongoose.disconnect();
    await new Promise((resolve) => server.close(resolve));
  });

  const submissionA = await api(baseUrl, '/complaints', {
    method: 'POST',
    body: {
      description: 'Runtime test complaint describing dowry harassment and threats.',
      complaintCategory: 'dowry_harassment',
      locationConsent: false,
      website: '',
      privacyAcknowledged: true,
      privacyNoticeVersion: 'privacy-2026-07-v1',
      consentVersion: 'consent-2026-07-v1',
      aiConsent: false
    }
  });
  assert.equal(submissionA.response.status, 201);
  const { caseId: caseA, accessSecret: secretA } = submissionA.payload.data;
  assert.match(caseA, /^anon-/);
  assert.ok(secretA.length >= 43);
  assert.deepEqual(Object.keys(submissionA.payload.data).sort(), [
    'accessSecret',
    'caseId',
    'createdAt'
  ]);

  const rawRecordA = await mongoose.connection.collection('complaints').findOne({
    anonymousId: caseA
  });
  assert.equal(typeof rawRecordA.reporterAccessSecretHash, 'string');
  assert.match(rawRecordA.reporterAccessSecretHash, /^[a-f0-9]{64}$/);
  assert.equal(rawRecordA.reporterAccessEnabled, true);
  assert.equal(rawRecordA.reporterAccessVersion, 1);
  assert.equal(JSON.stringify(rawRecordA).includes(secretA), false);
  assert.equal(rawRecordA.submissionFingerprintHash, undefined);
  assert.equal(rawRecordA.privacyAcknowledged, true);
  assert.equal(rawRecordA.privacyNoticeVersion, 'privacy-2026-07-v1');
  assert.equal(rawRecordA.aiConsent, false);
  assert.equal(rawRecordA.aiProcessing.used, false);
  assert.equal(rawRecordA.aiProcessing.provider, 'disabled');
  assert.equal(rawRecordA.retentionPolicyVersion, 'retention-2026-07-v1');
  assert.ok(rawRecordA.retentionEligibleAt instanceof Date);

  const notification = await mongoose.connection.collection('notifications').findOne({});
  assert.equal(notification.message, undefined);
  assert.equal(notification.complaintAnonymousId, undefined);
  assert.equal(notification.deliveryState, 'skipped_not_configured');
  assert.match(notification.resourceRef, /^[a-f0-9]{24}$/);

  const beforeRetentionCounts = await Promise.all(
    ['complaints', 'evidences', 'auditlogs'].map((name) =>
      mongoose.connection.collection(name).countDocuments()
    )
  );
  const retentionReport = await buildRetentionDryRunReport(new Date('2100-01-01T00:00:00Z'));
  const afterRetentionCounts = await Promise.all(
    ['complaints', 'evidences', 'auditlogs'].map((name) =>
      mongoose.connection.collection(name).countDocuments()
    )
  );
  assert.equal(retentionReport.mode, 'dry-run');
  assert.equal(retentionReport.mutationsPerformed, 0);
  assert.deepEqual(afterRetentionCounts, beforeRetentionCounts);

  const exchangeA = await api(baseUrl, '/complaints/reporter-access/token', {
    method: 'POST',
    body: { caseId: caseA, accessSecret: secretA }
  });
  assert.equal(exchangeA.response.status, 200);
  const tokenA = exchangeA.payload.data.accessToken;
  assert.ok(tokenA);
  assert.equal(verifyReporterCaseToken(tokenA).caseId, caseA);
  assert.equal(JSON.stringify(exchangeA.payload).includes(secretA), false);

  const detailA = await api(baseUrl, `/complaints/lookup/${caseA}`, { token: tokenA });
  assert.equal(detailA.response.status, 200, JSON.stringify(detailA.payload));
  assert.equal(detailA.payload.data.complaint.caseId, caseA);
  const reporterComplaintJson = JSON.stringify(detailA.payload.data.complaint);
  for (const forbidden of [
    '_id',
    'reporterAccessSecretHash',
    'riskScore',
    'detectedKeywords',
    'escalationRecommendation',
    'threatSummary',
    'contactEmail',
    'contactPhone',
    'assignedInvestigator',
    'assignmentSource',
    'matchedOn'
  ]) {
    assert.equal(reporterComplaintJson.includes(forbidden), false);
  }

  const timelineA = await api(baseUrl, `/complaints/lookup/${caseA}/timeline`, {
    token: tokenA
  });
  assert.equal(timelineA.response.status, 200);
  assert.equal(timelineA.payload.data.history.length, 1);
  assert.equal(timelineA.payload.data.history[0]._id, undefined);
  assert.equal(timelineA.payload.data.history[0].userName, undefined);

  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
    'base64'
  );
  const formData = new FormData();
  formData.append('media', new Blob([png], { type: 'image/png' }), 'runtime-evidence.png');
  const upload = await api(baseUrl, `/complaints/lookup/${caseA}/evidence`, {
    method: 'POST',
    token: tokenA,
    formData
  });
  assert.equal(upload.response.status, 201);
  assert.equal(upload.payload.data.evidence.fileUrl, undefined);
  assert.equal(upload.payload.data.evidence._id, undefined);

  const evidence = await api(baseUrl, `/complaints/lookup/${caseA}/evidence`, {
    token: tokenA
  });
  assert.equal(evidence.response.status, 200);
  assert.equal(evidence.payload.data.evidenceList.length, 1);
  const evidenceJson = JSON.stringify(evidence.payload.data.evidenceList[0]);
  for (const forbidden of ['_id', 'fileUrl', 'uploaderId', 'metadata', 'path']) {
    assert.equal(evidenceJson.includes(forbidden), false);
  }

  const chatSend = await api(baseUrl, `/chat/${caseA}`, {
    method: 'POST',
    token: tokenA,
    body: { text: 'Runtime reporter message' }
  });
  assert.equal(chatSend.response.status, 201);
  assert.equal(chatSend.payload.data.message.senderLabel, 'Reporter');
  assert.equal(chatSend.payload.data.message.id, undefined);

  const chatRead = await api(baseUrl, `/chat/${caseA}`, { token: tokenA });
  assert.equal(chatRead.response.status, 200);
  assert.equal(chatRead.payload.data.messages.length, 1);
  assert.equal(chatRead.payload.data.messages[0].readBy, undefined);

  const markRead = await api(baseUrl, `/chat/${caseA}/read`, {
    method: 'POST',
    token: tokenA
  });
  assert.equal(markRead.response.status, 200);

  const submissionB = await api(baseUrl, '/complaints', {
    method: 'POST',
    body: {
      description: 'A separate runtime test complaint for scope isolation.',
      complaintCategory: 'dowry_harassment',
      locationConsent: false,
      website: '',
      privacyAcknowledged: true,
      privacyNoticeVersion: 'privacy-2026-07-v1',
      consentVersion: 'consent-2026-07-v1',
      aiConsent: false
    }
  });
  assert.equal(submissionB.response.status, 201);
  const caseB = submissionB.payload.data.caseId;
  const crossCase = await api(baseUrl, `/complaints/lookup/${caseB}`, { token: tokenA });
  assert.equal(crossCase.response.status, 403);
  assert.equal(crossCase.payload.code, 'REPORTER_CASE_SCOPE_DENIED');

  const genericAttempts = [
    { caseId: caseA, accessSecret: `${secretA}wrong` },
    {
      caseId: 'anon-99999999-9999-4999-8999-999999999999',
      accessSecret: `${secretA}wrong`
    }
  ];
  for (const credentials of genericAttempts) {
    const result = await api(baseUrl, '/complaints/reporter-access/token', {
      method: 'POST',
      body: credentials
    });
    assert.equal(result.response.status, 401);
    assert.equal(result.payload.code, 'REPORTER_ACCESS_INVALID');
    assert.equal(result.payload.message, 'Case access credentials are invalid.');
  }

  const legacyId = 'anon-77777777-7777-4777-8777-777777777777';
  await Complaint.create({
    anonymousId: legacyId,
    reporterAccessEnabled: false,
    reporterAccessVersion: 0,
    status: 'submitted',
    privacyAcknowledged: true,
    privacyNoticeVersion: 'privacy-2026-07-v1',
    consentVersion: 'consent-2026-07-v1',
    retentionPolicyVersion: 'retention-2026-07-v1',
    retentionEligibleAt: new Date(Date.now() + 86400000)
  });
  const legacy = await api(baseUrl, '/complaints/reporter-access/token', {
    method: 'POST',
    body: { caseId: legacyId, accessSecret: `${secretA}wrong` }
  });
  assert.equal(legacy.response.status, 401);
  assert.equal(legacy.payload.code, 'REPORTER_ACCESS_INVALID');
  assert.equal(legacy.payload.message, 'Case access credentials are invalid.');

  const expiredToken = jwt.sign(
    { tokenType: 'reporter_case_access', caseId: caseA },
    env.reporterTokenSecret,
    {
      audience: env.reporterTokenAudience,
      issuer: env.jwtIssuer,
      subject: `case:${caseA}`,
      expiresIn: -1
    }
  );
  const expired = await api(baseUrl, `/complaints/lookup/${caseA}`, {
    token: expiredToken
  });
  assert.equal(expired.response.status, 401);
  assert.equal(expired.payload.code, 'REPORTER_ACCESS_EXPIRED');

  const dashboardDenied = await api(baseUrl, '/dashboard/summary', { token: tokenA });
  assert.equal(dashboardDenied.response.status, 401);

  const staffPassword = 'RuntimeStaffPassword!42';
  await User.create({
    name: 'Runtime Test Admin',
    email: 'phase1-runtime-admin@example.invalid',
    passwordHash: await bcrypt.hash(staffPassword, 10),
    role: 'admin',
    isVerified: true
  });
  const staffLogin = await api(baseUrl, '/auth/login', {
    method: 'POST',
    body: {
      email: 'phase1-runtime-admin@example.invalid',
      password: staffPassword
    }
  });
  assert.equal(staffLogin.response.status, 200);
  const staffToken = staffLogin.payload.data.accessToken;
  const dashboardAllowed = await api(baseUrl, '/dashboard/summary', { token: staffToken });
  assert.equal(dashboardAllowed.response.status, 200);
  const rawSession = await mongoose.connection.collection('sessions').findOne({});
  assert.ok(['desktop', 'mobile', 'tablet', 'unknown'].includes(rawSession.deviceCategory));
  assert.equal(rawSession.ipAddress, undefined);
  assert.equal(rawSession.userAgent, undefined);

  const auditRecords = await mongoose.connection.collection('auditlogs').find({}).toArray();
  const auditJson = JSON.stringify(auditRecords);
  for (const forbidden of ['userEmail', 'ipAddress', 'userAgent', 'description', 'message']) {
    assert.equal(auditJson.includes(`"${forbidden}"`), false);
  }

  let rateLimited;
  for (let attempt = 0; attempt < 9; attempt += 1) {
    rateLimited = await api(baseUrl, '/complaints/reporter-access/token', {
      method: 'POST',
      body: {
        caseId: 'anon-88888888-8888-4888-8888-888888888888',
        accessSecret: 'invalid-secret-value-with-more-than-32-characters'
      }
    });
    if (rateLimited.response.status === 429) break;
  }
  assert.equal(rateLimited.response.status, 429);
  assert.equal(rateLimited.payload.code, 'REPORTER_ACCESS_RATE_LIMITED');
});
