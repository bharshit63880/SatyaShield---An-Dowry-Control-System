import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import test from 'node:test';
import mongoose from 'mongoose';

const runtimeUri = process.env.MONGODB_URI ?? '';
const databaseName = runtimeUri.match(/\/([^/?]+)(?:\?|$)/)?.[1] ?? '';
const runtimeEnabled = /^ss_p(?:[345789]|10)_rt_[a-z0-9_]+$/i.test(databaseName);
process.env.EVIDENCE_ENCRYPTION_KEY ||= 'e'.repeat(64);
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
  !/^ss_p[12457]_rt_[a-z0-9_]+$/i.test(databaseName)
) {
  throw new Error('Runtime test refused: MONGODB_URI must target a dedicated guarded test database.');
}

const { default: app } = await import('../../src/app.js');
const { connectDatabase } = await import('../../src/config/db.js');
const { privateEvidenceDirectory } = await import('../../src/config/paths.js');
const { User } = await import('../../src/models/user.model.js');
const { NGO } = await import('../../src/models/ngo.model.js');
const { NgoAssignment } = await import('../../src/models/ngo-assignment.model.js');
const { Investigator } = await import('../../src/models/investigator.model.js');
const { Complaint } = await import('../../src/models/complaint.model.js');
const { Evidence } = await import('../../src/models/evidence.model.js');
const { EvidenceHistory } = await import('../../src/models/evidence-history.model.js');
const { signAccessToken } = await import('../../src/utils/jwt.js');
const { createVaultEvidence } = await import('../../src/services/evidence-vault.service.js');

async function api(baseUrl, pathName, { method = 'GET', token, body, formData, binary = false } = {}) {
  const response = await fetch(`${baseUrl}${pathName}`, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {})
    },
    body: formData ?? (body ? JSON.stringify(body) : undefined)
  });
  if (binary && response.ok) {
    return { response, bytes: Buffer.from(await response.arrayBuffer()) };
  }
  return { response, payload: await response.json().catch(() => ({})) };
}

test('MongoDB-backed Phase 3 private evidence vault flow', { skip: !runtimeEnabled }, async (t) => {
  await connectDatabase();
  await mongoose.connection.dropDatabase();
  await fs.rm(privateEvidenceDirectory, { recursive: true, force: true });
  await fs.mkdir(privateEvidenceDirectory, { recursive: true });
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const apiBase = `${baseUrl}/api/v1`;
  t.after(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
    await new Promise((resolve) => server.close(resolve));
    await fs.rm(privateEvidenceDirectory, { recursive: true, force: true });
  });

  const submission = await api(apiBase, '/complaints', {
    method: 'POST',
    body: {
      description: 'Phase 3 private vault runtime complaint with sufficient detail.',
      complaintCategory: 'dowry_harassment',
      locationConsent: false,
      website: '',
      privacyAcknowledged: true,
      privacyNoticeVersion: 'privacy-2026-07-v1',
      consentVersion: 'consent-2026-07-v1',
      aiConsent: false
    }
  });
  assert.equal(submission.response.status, 201);
  const caseA = submission.payload.data.caseId;
  const exchange = await api(apiBase, '/complaints/reporter-access/token', {
    method: 'POST',
    body: { caseId: caseA, accessSecret: submission.payload.data.accessSecret }
  });
  const reporterA = exchange.payload.data.accessToken;

  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
    'base64'
  );
  const form = new FormData();
  form.append('media', new Blob([png], { type: 'image/png' }), '../sensitive proof.png');
  const upload = await api(apiBase, `/complaints/lookup/${caseA}/evidence`, {
    method: 'POST',
    token: reporterA,
    formData: form
  });
  assert.equal(upload.response.status, 201, JSON.stringify(upload.payload));
  const safeEvidence = upload.payload.data.evidence;
  assert.match(safeEvidence.evidenceId, /^[0-9a-f-]{36}$/i);
  assert.equal(safeEvidence.lifecycleStatus, 'available');
  assert.equal(safeEvidence.scanStatus, 'not_configured');
  assert.equal(JSON.stringify(safeEvidence).includes('storage'), false);
  assert.equal(JSON.stringify(safeEvidence).includes('fileUrl'), false);

  const raw = await Evidence.findOne({ evidenceId: safeEvidence.evidenceId })
    .select('+storageId +plaintextDigest +encryptedStorageDigest')
    .lean();
  assert.equal(raw.complaintId, caseA);
  assert.equal(raw.detectedMimeType, 'image/png');
  assert.equal(raw.detectedExtension, '.png');
  assert.equal(raw.plaintextDigest, crypto.createHash('sha256').update(png).digest('hex'));
  assert.match(raw.storageId, /^[a-f0-9]{64}$/);
  assert.equal(raw.storageId.includes(caseA), false);
  assert.equal(raw.storageId.includes('proof'), false);
  const storagePath = path.join(privateEvidenceDirectory, raw.storageId);
  const encrypted = await fs.readFile(storagePath);
  assert.equal(encrypted.includes(png), false);

  const jpeg = Buffer.concat([
    Buffer.from([0xff, 0xd8]),
    Buffer.alloc(32, 7),
    Buffer.from([0xff, 0xd9])
  ]);
  const scannerRequest = { user: null };
  const cleanEvidence = await createVaultEvidence({
    file: { buffer: jpeg, originalname: 'clean.jpg', mimetype: 'image/jpeg' },
    complaintId: caseA,
    req: scannerRequest,
    scanner: { scan: async () => ({ status: 'clean', engine: 'test-double', engineVersion: '1' }) }
  });
  assert.equal(cleanEvidence.lifecycleStatus, 'available');
  assert.equal(cleanEvidence.scanStatus, 'clean');
  const infectedEvidence = await createVaultEvidence({
    file: { buffer: jpeg, originalname: 'infected.jpg', mimetype: 'image/jpeg' },
    complaintId: caseA,
    req: scannerRequest,
    scanner: { scan: async () => ({ status: 'infected', engine: 'test-double', engineVersion: '1' }) }
  });
  assert.equal(infectedEvidence.lifecycleStatus, 'quarantined');
  const scannerFailureEvidence = await createVaultEvidence({
    file: { buffer: jpeg, originalname: 'failure.jpg', mimetype: 'image/jpeg' },
    complaintId: caseA,
    req: scannerRequest,
    scanner: { scan: async () => { throw new Error('scanner unavailable'); } }
  });
  assert.equal(scannerFailureEvidence.lifecycleStatus, 'pending_scan');
  const cleanHistory = await EvidenceHistory.find({ evidenceId: cleanEvidence.evidenceId }).lean();
  assert.deepEqual(cleanHistory.map((item) => item.event), [
    'uploaded',
    'scan_started',
    'scan_passed',
    'made_available'
  ]);
  assert.equal(JSON.stringify(cleanHistory).includes(raw.storageId), false);

  const publicAttempt = await api(baseUrl, `/uploads/${raw.storageId}`);
  assert.equal(publicAttempt.response.status, 404);
  const authorizedDownload = await api(
    apiBase,
    `/complaints/lookup/${caseA}/evidence/${safeEvidence.evidenceId}/download`,
    { token: reporterA, binary: true }
  );
  assert.equal(authorizedDownload.response.status, 200);
  assert.deepEqual(authorizedDownload.bytes, png);
  assert.equal(authorizedDownload.response.headers.get('x-content-type-options'), 'nosniff');
  assert.match(authorizedDownload.response.headers.get('cache-control'), /no-store/);

  const submissionB = await api(apiBase, '/complaints', {
    method: 'POST',
    body: {
      description: 'Separate Phase 3 complaint for cross-case isolation.',
      complaintCategory: 'dowry_harassment',
      locationConsent: false,
      website: '',
      privacyAcknowledged: true,
      privacyNoticeVersion: 'privacy-2026-07-v1',
      consentVersion: 'consent-2026-07-v1',
      aiConsent: false
    }
  });
  const caseB = submissionB.payload.data.caseId;
  const exchangeB = await api(apiBase, '/complaints/reporter-access/token', {
    method: 'POST',
    body: { caseId: caseB, accessSecret: submissionB.payload.data.accessSecret }
  });
  const reporterB = exchangeB.payload.data.accessToken;
  const crossCase = await api(
    apiBase,
    `/complaints/lookup/${caseA}/evidence/${safeEvidence.evidenceId}/download`,
    { token: reporterB }
  );
  assert.equal(crossCase.response.status, 403);
  const substitution = await api(
    apiBase,
    `/complaints/lookup/${caseB}/evidence/${safeEvidence.evidenceId}/download`,
    { token: reporterB }
  );
  assert.equal(substitution.response.status, 404);

  const [ngoUser, otherNgoUser, invUser, otherInvUser] = await User.create([
    { name: 'NGO A', email: 'p3-ngoa@test.invalid', passwordHash: 'x', role: 'ngo', isVerified: true },
    { name: 'NGO B', email: 'p3-ngob@test.invalid', passwordHash: 'x', role: 'ngo', isVerified: true },
    { name: 'Inv A', email: 'p3-inva@test.invalid', passwordHash: 'x', role: 'investigator', isVerified: true },
    { name: 'Inv B', email: 'p3-invb@test.invalid', passwordHash: 'x', role: 'investigator', isVerified: true }
  ]);
  const [ngoA] = await NGO.create([{
    userId: ngoUser.id, name: 'NGO A', email: 'p3-ngoa@test.invalid', phone: '1',
    city: 'A', district: 'A', verificationStatus: 'approved', profileVersion: 1,
    approvedProfileVersion: 1, operationalStatus: 'active', acceptsNewAssignments: true,
    supportedCategories: ['dowry_harassment'], remoteSupport: true
  }, {
    userId: otherNgoUser.id, name: 'NGO B', email: 'p3-ngob@test.invalid', phone: '2',
    city: 'B', district: 'B', verificationStatus: 'approved', profileVersion: 1,
    approvedProfileVersion: 1, operationalStatus: 'active', acceptsNewAssignments: true,
    supportedCategories: ['dowry_harassment'], remoteSupport: true
  }]);
  await Investigator.create([
    { userId: invUser.id, name: 'Inv A', badgeNumber: 'P3-A', agency: 'A', phone: '1', isActive: true, isEligible: true },
    { userId: otherInvUser.id, name: 'Inv B', badgeNumber: 'P3-B', agency: 'A', phone: '2', isActive: true, isEligible: true }
  ]);
  await Complaint.updateOne({ anonymousId: caseA }, {
    assignedNgo: { ngoId: ngoA.publicId, name: ngoA.name },
    assignedInvestigator: { investigatorId: invUser.id, name: invUser.name }
  });
  await NgoAssignment.create({
    complaintId: caseA, ngoPublicId: ngoA.publicId, state: 'acknowledged',
    source: 'manual', routingPolicyVersion: 'ngo-routing-v1', acknowledgedAt: new Date()
  });
  const ngoToken = signAccessToken({ subject: ngoUser.id, role: 'ngo' });
  const otherNgoToken = signAccessToken({ subject: otherNgoUser.id, role: 'ngo' });
  const invToken = signAccessToken({ subject: invUser.id, role: 'investigator' });
  const otherInvToken = signAccessToken({ subject: otherInvUser.id, role: 'investigator' });
  for (const [token, status] of [[ngoToken, 200], [invToken, 200], [otherNgoToken, 403], [otherInvToken, 403]]) {
    const result = await api(
      apiBase,
      `/complaints/lookup/${caseA}/evidence/${safeEvidence.evidenceId}/download`,
      { token, binary: status === 200 }
    );
    assert.equal(result.response.status, status);
  }

  const arbitraryAttachment = await api(apiBase, `/chat/${caseA}`, {
    method: 'POST',
    token: reporterA,
    body: { text: 'bad attachment', attachments: [{ fileUrl: 'https://evil.invalid/file' }] }
  });
  assert.equal(arbitraryAttachment.response.status, 422);
  const sameCaseAttachment = await api(apiBase, `/chat/${caseA}`, {
    method: 'POST',
    token: reporterA,
    body: { text: 'vault reference', attachments: [{ evidenceId: safeEvidence.evidenceId }] }
  });
  assert.equal(sameCaseAttachment.response.status, 201);

  await Complaint.updateOne({ anonymousId: caseA }, {
    $set: {
      'assignedNgo.ngoId': null,
      'assignedInvestigator.investigatorId': null
    }
  });
  await NgoAssignment.updateOne(
    { complaintId: caseA, ngoPublicId: ngoA.publicId, isCurrent: true },
    { state: 'withdrawn', isCurrent: false, withdrawnAt: new Date() }
  );
  for (const staffToken of [ngoToken, invToken]) {
    const revoked = await api(
      apiBase,
      `/complaints/lookup/${caseA}/evidence/${safeEvidence.evidenceId}/download`,
      { token: staffToken }
    );
    assert.equal(revoked.response.status, 403);
  }

  const originalEncrypted = await fs.readFile(storagePath);
  const tampered = Buffer.from(originalEncrypted);
  tampered[tampered.length - 1] ^= 1;
  await fs.writeFile(storagePath, tampered);
  const tamperResult = await api(
    apiBase,
    `/complaints/lookup/${caseA}/evidence/${safeEvidence.evidenceId}/download`,
    { token: reporterA }
  );
  assert.equal(tamperResult.response.status, 409);
  await fs.writeFile(storagePath, originalEncrypted);

  for (const lifecycleStatus of ['pending_scan', 'quarantined', 'rejected', 'deleted', 'missing']) {
    await Evidence.updateOne({ evidenceId: safeEvidence.evidenceId }, { lifecycleStatus });
    const unavailable = await api(
      apiBase,
      `/complaints/lookup/${caseA}/evidence/${safeEvidence.evidenceId}/download`,
      { token: reporterA }
    );
    assert.equal(unavailable.response.status, 409);
  }
  await Evidence.updateOne({ evidenceId: safeEvidence.evidenceId }, { lifecycleStatus: 'available' });
});
