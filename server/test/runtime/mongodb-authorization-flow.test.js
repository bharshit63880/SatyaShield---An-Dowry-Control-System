import assert from 'node:assert/strict';
import http from 'node:http';
import test from 'node:test';
import mongoose from 'mongoose';

const runtimeUri = process.env.MONGODB_URI ?? '';
const databaseName = runtimeUri.match(/\/([^/?]+)(?:\?|$)/)?.[1] ?? '';
const runtimeEnabled = /^ss_p(?:[245789]|10)_rt_[a-z0-9_]+$/i.test(databaseName);
process.env.EVIDENCE_ENCRYPTION_KEY ||= 'd'.repeat(64);
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
  !/^ss_p[13457]_rt_[a-z0-9_]+$/i.test(databaseName)
) {
  throw new Error('Runtime test refused: MONGODB_URI must target a dedicated Phase 2 test database.');
}

const { default: app } = await import('../../src/app.js');
const { connectDatabase } = await import('../../src/config/db.js');
const { User } = await import('../../src/models/user.model.js');
const { NGO } = await import('../../src/models/ngo.model.js');
const { NgoAssignment } = await import('../../src/models/ngo-assignment.model.js');
const { Investigator } = await import('../../src/models/investigator.model.js');
const { Complaint } = await import('../../src/models/complaint.model.js');
const { Evidence } = await import('../../src/models/evidence.model.js');
const { encryptSensitiveValue } = await import('../../src/utils/crypto.js');
const { signAccessToken } = await import('../../src/utils/jwt.js');

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

test('MongoDB-backed Phase 2 resource authorization matrix', { skip: !runtimeEnabled }, async (t) => {
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

  async function user(role, suffix) {
    return User.create({
      name: `${role} ${suffix}`,
      email: `${role}-${suffix}@phase2.invalid`,
      passwordHash: 'runtime-test-password-hash',
      role,
      isVerified: true
    });
  }
  const [admin, ngoUserA, ngoUserB, pendingNgoUser, inactiveNgoUser, invUserA, invUserB, inactiveInvUser] =
    await Promise.all([
      user('admin', 'admin'),
      user('ngo', 'a'),
      user('ngo', 'b'),
      user('ngo', 'pending'),
      user('ngo', 'inactive'),
      user('investigator', 'a'),
      user('investigator', 'b'),
      user('investigator', 'inactive')
    ]);

  const eligibleNgo = { supportedCategories: ['dowry_harassment'], supportedLanguages: [],
    coverage: [], remoteSupport: true, verificationStatus: 'approved', profileVersion: 1,
    approvedProfileVersion: 1, operationalStatus: 'active', acceptsNewAssignments: true };
  const [ngoA, ngoB, pendingNgo, inactiveNgo] = await NGO.create([
    { ...eligibleNgo, userId: ngoUserA.id, name: 'NGO A', email: 'ngoa@phase2.invalid', phone: '1', city: 'A', district: 'A' },
    { ...eligibleNgo, userId: ngoUserB.id, name: 'NGO B', email: 'ngob@phase2.invalid', phone: '2', city: 'B', district: 'B' },
    { ...eligibleNgo, userId: pendingNgoUser.id, name: 'NGO Pending', email: 'ngop@phase2.invalid', phone: '3', city: 'P', district: 'P', verificationStatus: 'submitted', approvedProfileVersion: null, operationalStatus: 'inactive', acceptsNewAssignments: false },
    { ...eligibleNgo, userId: inactiveNgoUser.id, name: 'NGO Inactive', email: 'ngoi@phase2.invalid', phone: '4', city: 'I', district: 'I', operationalStatus: 'inactive' }
  ]);
  const [invA, invB, inactiveInv] = await Investigator.create([
    { userId: invUserA.id, name: 'Investigator A', badgeNumber: 'P2-A', agency: 'Agency', phone: '1', isActive: true, isEligible: true },
    { userId: invUserB.id, name: 'Investigator B', badgeNumber: 'P2-B', agency: 'Agency', phone: '2', isActive: true, isEligible: true },
    { userId: inactiveInvUser.id, name: 'Investigator Inactive', badgeNumber: 'P2-I', agency: 'Agency', phone: '3', isActive: false, isEligible: false }
  ]);

  const makeComplaint = (anonymousId, assignedNgo, assignedInvestigator) => Complaint.create({
    anonymousId,
    descriptionEncrypted: encryptSensitiveValue(`Sensitive description for ${anonymousId}`),
    status: 'submitted',
    complaintCategory: 'dowry_harassment',
    riskScore: 70,
    riskLevel: 'high',
    indicators: { dowryHarassment: true },
    detectedKeywords: ['internal-keyword'],
    threatSummary: 'internal summary',
    escalationRecommendation: 'internal recommendation',
    assignedNgo: assignedNgo ? {
      ngoId: assignedNgo.publicId, name: assignedNgo.name, acknowledgedAt: new Date()
    } : undefined,
    assignedInvestigator: assignedInvestigator
      ? { investigatorId: assignedInvestigator.userId, name: assignedInvestigator.name, badgeNumber: assignedInvestigator.badgeNumber }
      : undefined
  });
  const [caseA, caseB, unassigned] = await Promise.all([
    makeComplaint('anon-p2-case-a', ngoA, invA),
    makeComplaint('anon-p2-case-b', ngoB, invB),
    makeComplaint('anon-p2-unassigned')
  ]);
  const [assignmentA, assignmentB] = await NgoAssignment.create([
    { complaintId: caseA.anonymousId, ngoPublicId: ngoA.publicId, state: 'acknowledged',
      source: 'manual', routingPolicyVersion: 'ngo-routing-v1', acknowledgedAt: new Date() },
    { complaintId: caseB.anonymousId, ngoPublicId: ngoB.publicId, state: 'acknowledged',
      source: 'manual', routingPolicyVersion: 'ngo-routing-v1', acknowledgedAt: new Date() }
  ]);
  await Evidence.create({
    complaintId: caseA.anonymousId,
    category: 'document',
    fileUrl: '/protected/evidence-a',
    originalName: 'evidence.pdf',
    mimeType: 'application/pdf',
    fileSize: 100,
    fileHash: 'a'.repeat(64),
    uploadedBy: 'admin',
    metadata: { storagePath: '/private/storage/path' }
  });

  const tokens = Object.fromEntries([
    admin, ngoUserA, ngoUserB, pendingNgoUser, inactiveNgoUser,
    invUserA, invUserB, inactiveInvUser
  ].map((account) => [
    account.email,
    signAccessToken({ subject: account.id, role: account.role })
  ]));
  const token = (account) => tokens[account.email];
  const expectStatus = async (path, account, status, options = {}) => {
    const result = await api(baseUrl, path, { token: token(account), ...options });
    assert.equal(result.response.status, status, `${path}: ${JSON.stringify(result.payload)}`);
    return result;
  };

  const ngoOwn = await expectStatus(`/complaints/lookup/${caseA.anonymousId}`, ngoUserA, 200);
  assert.equal(ngoOwn.payload.data.complaint.riskScore, undefined);
  assert.equal(ngoOwn.payload.data.complaint.assignedInvestigator, undefined);
  const acknowledgment = await expectStatus(
    `/ngos/assignments/${assignmentA.assignmentId}/acknowledge`,
    ngoUserA,
    200,
    { method: 'POST' }
  );
  assert.equal(acknowledgment.payload.data.assignment.state, 'acknowledged');
  await expectStatus(
    `/ngos/assignments/not-an-assignment/acknowledge`,
    ngoUserA,
    409,
    { method: 'POST' }
  );
  for (const path of [
    `/complaints/lookup/${caseB.anonymousId}`,
    `/complaints/lookup/${unassigned.anonymousId}`,
    `/chat/${caseB.anonymousId}`,
    `/chat/${caseB.anonymousId}/read`,
    `/complaints/lookup/${caseB.anonymousId}/evidence`
  ]) {
    await expectStatus(path, ngoUserA, 403, path.endsWith('/read') ? { method: 'POST' } : {});
  }
  await expectStatus('/ngos/dashboard', pendingNgoUser, 403);
  await expectStatus('/ngos/dashboard', inactiveNgoUser, 403);
  await expectStatus('/dashboard/analytics', ngoUserA, 403);
  await expectStatus('/dashboard/audit-logs', ngoUserA, 403);

  await expectStatus(`/complaints/lookup/${caseB.anonymousId}`, invUserA, 403);
  await expectStatus(`/investigators/complaints/${caseB.anonymousId}/notes`, invUserA, 403, {
    method: 'POST',
    body: { note: 'must not be stored' }
  });
  await expectStatus(`/investigators/complaints/${unassigned.anonymousId}/notes`, invUserA, 403, {
    method: 'POST',
    body: { note: 'must not be stored' }
  });
  await expectStatus(`/investigators/complaints/${caseA.anonymousId}/notes`, invUserA, 201, {
    method: 'POST',
    body: { note: 'Assigned-case operational note' }
  });
  await expectStatus(`/dashboard/complaints/${caseA.anonymousId}/status`, invUserA, 403, {
    method: 'PATCH',
    body: { status: 'under-review' }
  });
  await expectStatus('/dashboard/analytics', invUserA, 403);
  await expectStatus('/dashboard/audit-logs', invUserA, 403);
  await expectStatus('/investigators/dashboard', inactiveInvUser, 403);

  await expectStatus(`/chat/${caseA.anonymousId}`, ngoUserA, 201, {
    method: 'POST',
    body: { text: 'NGO A assigned-case message' }
  });
  await expectStatus(`/chat/${caseA.anonymousId}`, invUserB, 403);
  await expectStatus(`/chat/${caseA.anonymousId}/read`, invUserB, 403, { method: 'POST' });
  const evidence = await expectStatus(`/complaints/lookup/${caseA.anonymousId}/evidence`, invUserA, 200);
  const evidenceJson = JSON.stringify(evidence.payload);
  assert.equal(evidenceJson.includes('storagePath'), false);
  assert.equal(evidenceJson.includes('uploaderId'), false);
  await expectStatus(`/complaints/lookup/${caseA.anonymousId}/evidence`, invUserB, 403);

  await expectStatus(`/dashboard/complaints/${unassigned.anonymousId}/ngo-offers`, admin, 201, {
    method: 'POST',
    body: { ngoPublicId: ngoA.publicId }
  });
  await expectStatus(`/dashboard/complaints/${unassigned.anonymousId}/assign-investigator`, admin, 200, {
    method: 'POST',
    body: { investigatorId: invA.userId }
  });
  for (const invalidNgo of [pendingNgo, inactiveNgo]) {
    await expectStatus(`/dashboard/complaints/${unassigned.anonymousId}/ngo-offers`, admin, 409, {
      method: 'POST',
      body: { ngoPublicId: invalidNgo.publicId }
    });
  }
  await expectStatus(`/dashboard/complaints/${caseA.anonymousId}/assign-investigator`, admin, 400, {
    method: 'POST',
    body: { investigatorId: inactiveInv.userId }
  });
  await expectStatus(`/dashboard/complaints/${caseA.anonymousId}/status`, admin, 200, {
    method: 'PATCH',
    body: { status: 'under-review' }
  });

  const reporterSubmission = await api(baseUrl, '/complaints', {
    method: 'POST',
    body: {
      description: 'Phase 2 reporter regression complaint with sufficient detail.',
      complaintCategory: 'dowry_harassment',
      locationConsent: false,
      website: '',
      privacyAcknowledged: true,
      privacyNoticeVersion: 'privacy-2026-07-v1',
      consentVersion: 'consent-2026-07-v1',
      aiConsent: false
    }
  });
  assert.equal(reporterSubmission.response.status, 201);
  const reporterExchange = await api(baseUrl, '/complaints/reporter-access/token', {
    method: 'POST',
    body: {
      caseId: reporterSubmission.payload.data.caseId,
      accessSecret: reporterSubmission.payload.data.accessSecret
    }
  });
  assert.equal(reporterExchange.response.status, 200);
  const reporterToken = reporterExchange.payload.data.accessToken;
  const reporterDetail = await api(
    baseUrl,
    `/complaints/lookup/${reporterSubmission.payload.data.caseId}`,
    { token: reporterToken }
  );
  assert.equal(reporterDetail.response.status, 200);
  const reporterDashboard = await api(baseUrl, '/dashboard/summary', { token: reporterToken });
  assert.equal(reporterDashboard.response.status, 401);
});
