import assert from 'node:assert/strict';
import http from 'node:http';
import test from 'node:test';
import mongoose from 'mongoose';
import { io as createClient } from 'socket.io-client';

const runtimeUri = process.env.MONGODB_URI || '';
const databaseName = runtimeUri.match(/\/([^/?]+)(?:\?|$)/)?.[1] || '';
const runtimeEnabled = /^ss_p(?:9|10)_rt_[a-z0-9_]+$/i.test(databaseName);
if (runtimeUri && !runtimeEnabled) {
  throw new Error('Phase 9 runtime test requires a dedicated ss_p9_rt_* database.');
}
process.env.AI_PROCESSING_ENABLED = 'false';
process.env.TRIAGE_AI_ENABLED = 'false';
process.env.ESCALATION_SCHEDULER_ENABLED = 'false';
process.env.SOCKET_IO_ENABLED = 'true';
process.env.SOCKET_SINGLE_INSTANCE_MODE = 'true';
process.env.SOCKET_ADAPTER = 'memory';
process.env.SOCKET_MESSAGE_RATE_LIMIT = '10';
for (const [key, value] of Object.entries({
  JWT_SECRET: 'p9-jwt-secret-at-least-32-characters',
  REPORTER_ACCESS_HMAC_KEY: 'p9-reporter-hmac-at-least-32-characters',
  REPORTER_TOKEN_SECRET: 'p9-reporter-token-at-least-32-characters',
  STAFF_ACCESS_TOKEN_SECRET: 'p9-staff-access-at-least-32-characters',
  REFRESH_TOKEN_PEPPER: 'p9-refresh-pepper-at-least-32-characters',
  VERIFICATION_TOKEN_PEPPER: 'p9-verification-at-least-32-characters',
  PASSWORD_RESET_TOKEN_PEPPER: 'p9-reset-pepper-at-least-32-characters',
  MFA_CHALLENGE_TOKEN_PEPPER: 'p9-mfa-challenge-at-least-32-characters',
  RECOVERY_CODE_PEPPER: 'p9-recovery-pepper-at-least-32-characters',
  MFA_ENCRYPTION_KEY: 'f'.repeat(64),
  LOCATION_ENCRYPTION_KEY: 'p9-location-at-least-32-characters',
  EVIDENCE_ENCRYPTION_KEY: 'd'.repeat(64)
})) process.env[key] ||= value;

const { default: app } = await import('../../src/app.js');
const { connectDatabase } = await import('../../src/config/db.js');
const { ChatMessage } = await import('../../src/models/chat-message.model.js');
const { Complaint } = await import('../../src/models/complaint.model.js');
const { Evidence } = await import('../../src/models/evidence.model.js');
const { NGO } = await import('../../src/models/ngo.model.js');
const { NgoAssignment } = await import('../../src/models/ngo-assignment.model.js');
const { Investigator } = await import('../../src/models/investigator.model.js');
const { User } = await import('../../src/models/user.model.js');
const { createComplaint } = await import('../../src/services/complaint.service.js');
const { revokeRealtimeComplaintAccess } =
  await import('../../src/services/realtime-revocation.service.js');
const { createSocketChatServer } = await import('../../src/services/socket-chat.service.js');
const { signAccessToken } = await import('../../src/utils/jwt.js');
const { signReporterCaseToken } = await import('../../src/utils/reporter-access.js');

const triageInput = {
  dangerHappeningNow: 'no', immediateThreatToLife: 'no', weaponInvolved: 'no',
  seriousInjuryPresent: 'no', currentlyConfined: 'no', threatEscalating: 'no',
  stalkingOrRepeatedContact: 'no', vulnerablePersonAtRisk: 'no',
  urgentMedicalHelpNeeded: 'no', canSafelyContinue: 'yes',
  reporterUrgency: 'routine', incidentRecency: 'historical',
  policyVersion: 'triage-policy-v1', inputSchemaVersion: 'triage-input-v1'
};
const createCase = (name) => createComplaint({
  description: `private socket narrative ${name}`, mediaType: 'none',
  locationConsent: false, approximateLocation: null,
  privacyAcknowledged: true, privacyNoticeVersion: 'privacy-2026-07-v1',
  consentVersion: 'consent-2026-07-v1', aiConsent: false,
  aiDisclosureVersion: null, complaintCategory: 'dowry_harassment',
  preferredLanguage: null, triageInput
});

const emitAck = (socket, event, payload) => new Promise((resolve, reject) => {
  const timeout = setTimeout(() => reject(new Error(`${event}_timeout`)), 5000);
  socket.emit(event, payload, (value) => {
    clearTimeout(timeout);
    resolve(value);
  });
});
const connect = (url, auth, query) => new Promise((resolve, reject) => {
  const socket = createClient(url, {
    auth, query, transports: ['websocket'], reconnection: false
  });
  socket.once('connect', () => resolve(socket));
  socket.once('connect_error', reject);
});
const expectConnectFailure = (url, auth, query) => new Promise((resolve, reject) => {
  const socket = createClient(url, {
    auth, query, transports: ['websocket'], reconnection: false
  });
  const timer = setTimeout(() => reject(new Error('connect_failure_timeout')), 5000);
  socket.once('connect', () => reject(new Error('unexpected_socket_connection')));
  socket.once('connect_error', () => {
    clearTimeout(timer);
    socket.close();
    resolve();
  });
});

test('MongoDB-backed Phase 9 real two-client secure Socket.IO lifecycle',
  { skip: !runtimeEnabled }, async (t) => {
    await connectDatabase();
    await mongoose.connection.dropDatabase();
    const server = http.createServer(app);
    const io = createSocketChatServer(server);
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const url = `http://127.0.0.1:${server.address().port}`;
    const sockets = [];
    t.after(async () => {
      sockets.forEach((socket) => socket.close());
      await io.close();
      if (server.listening) await new Promise((resolve) => server.close(resolve));
      await mongoose.connection.dropDatabase();
      await mongoose.disconnect();
    });

    const [caseA, caseB] = await Promise.all([createCase('A'), createCase('B')]);
    const [ngoUser, invUser, admin] = await User.create([
      { name: 'Socket NGO', email: 'p9-ngo@test.invalid', passwordHash: 'x',
        role: 'ngo', isVerified: true },
      { name: 'Socket investigator', email: 'p9-inv@test.invalid', passwordHash: 'x',
        role: 'investigator', isVerified: true },
      { name: 'Socket admin', email: 'p9-admin@test.invalid', passwordHash: 'x',
        role: 'admin', isVerified: true }
    ]);
    const ngo = await NGO.create({
      userId: ngoUser.id, name: 'Socket NGO Profile',
      email: 'p9-ngo-profile@test.invalid',
      verificationStatus: 'approved', profileVersion: 1, approvedProfileVersion: 1,
      operationalStatus: 'active', acceptsNewAssignments: true,
      supportedCategories: ['dowry_harassment'], remoteSupport: true
    });
    const assignment = await NgoAssignment.create({
      complaintId: caseA.complaint.anonymousId, ngoPublicId: ngo.publicId,
      state: 'acknowledged', isCurrent: true, source: 'manual',
      routingPolicyVersion: 'ngo-routing-v1', acknowledgedAt: new Date()
    });
    await Investigator.create({
      userId: invUser.id, name: 'Socket investigator', badgeNumber: 'P9-I',
      agency: 'Test', phone: 'x', isActive: true, isEligible: true
    });
    await Complaint.updateOne({ anonymousId: caseA.complaint.anonymousId }, {
      assignedInvestigator: {
        investigatorId: invUser.id, name: 'Socket investigator'
      }
    });

    const reporterTokenA = signReporterCaseToken(caseA.complaint.anonymousId);
    const reporterTokenB = signReporterCaseToken(caseB.complaint.anonymousId);
    const ngoToken = signAccessToken({ subject: ngoUser.id, role: 'ngo' });
    const invToken = signAccessToken({ subject: invUser.id, role: 'investigator' });
    const adminToken = signAccessToken({ subject: admin.id, role: 'admin' });

    await expectConnectFailure(url,
      { credentialType: 'staff', token: 'opaque-refresh-token' });
    await expectConnectFailure(url, {}, { token: reporterTokenA });

    const reporterA = await connect(url, {
      credentialType: 'reporter', token: reporterTokenA
    });
    const reporterB = await connect(url, {
      credentialType: 'reporter', token: reporterTokenB
    });
    const ngoSocket = await connect(url, {
      credentialType: 'staff', token: ngoToken
    });
    const invSocket = await connect(url, {
      credentialType: 'staff', token: invToken
    });
    const adminSocket = await connect(url, {
      credentialType: 'staff', token: adminToken
    });
    sockets.push(reporterA, reporterB, ngoSocket, invSocket, adminSocket);

    const beforeJoin = await emitAck(reporterA, 'message:send', {
      caseId: caseA.complaint.anonymousId, text: 'not yet joined',
      clientMessageId: 'before-join-001'
    });
    assert.equal(beforeJoin.ok, false);
    assert.equal(await ChatMessage.countDocuments(), 0);

    assert.equal((await emitAck(reporterA, 'case:join', {
      caseId: caseA.complaint.anonymousId
    })).ok, true);
    assert.equal((await emitAck(reporterA, 'case:join', {
      caseId: caseB.complaint.anonymousId
    })).ok, false);
    assert.equal((await emitAck(reporterB, 'case:join', {
      caseId: caseB.complaint.anonymousId
    })).ok, true);
    assert.equal((await emitAck(ngoSocket, 'case:join', {
      caseId: caseA.complaint.anonymousId
    })).ok, true);
    assert.equal((await emitAck(ngoSocket, 'case:join', {
      caseId: caseB.complaint.anonymousId
    })).ok, false);
    assert.equal((await emitAck(invSocket, 'case:join', {
      caseId: caseA.complaint.anonymousId
    })).ok, true);
    assert.equal((await emitAck(invSocket, 'case:join', {
      caseId: caseB.complaint.anonymousId
    })).ok, false);
    assert.equal((await emitAck(adminSocket, 'case:join', {
      caseId: caseA.complaint.anonymousId
    })).ok, true);

    const delivered = new Promise((resolve) => ngoSocket.once('message:created', resolve));
    const sent = await emitAck(reporterA, 'message:send', {
      caseId: caseA.complaint.anonymousId,
      text: '<b>plain text only</b>',
      clientMessageId: 'reporter-message-001'
    });
    assert.equal(sent.ok, true);
    assert.equal(sent.message.deliveryState, 'delivered_to_connected_client');
    assert.equal((await delivered).text, '<b>plain text only</b>');
    assert.equal(await ChatMessage.countDocuments(), 1);
    const replay = await emitAck(reporterA, 'message:send', {
      caseId: caseA.complaint.anonymousId,
      text: 'different replay text',
      clientMessageId: 'reporter-message-001'
    });
    assert.equal(replay.duplicate, true);
    assert.equal(await ChatMessage.countDocuments(), 1);

    const available = await Evidence.create({
      evidenceId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      complaintId: caseA.complaint.anonymousId, category: 'document',
      originalName: 'safe.txt', fileSize: 1, lifecycleStatus: 'available',
      reporterVisible: true, uploadedBy: 'victim'
    });
    await Evidence.create({
      evidenceId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      complaintId: caseB.complaint.anonymousId, category: 'document',
      originalName: 'other.txt', fileSize: 1, lifecycleStatus: 'available',
      reporterVisible: true, uploadedBy: 'victim'
    });
    await Evidence.create({
      evidenceId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      complaintId: caseA.complaint.anonymousId, category: 'document',
      originalName: 'quarantine.txt', fileSize: 1, lifecycleStatus: 'quarantined',
      reporterVisible: true, uploadedBy: 'victim'
    });
    assert.equal((await emitAck(reporterA, 'message:send', {
      caseId: caseA.complaint.anonymousId, text: '',
      attachments: ['https://example.invalid/public-file'],
      clientMessageId: 'bad-url-attachment'
    })).ok, false);
    assert.equal((await emitAck(reporterA, 'message:send', {
      caseId: caseA.complaint.anonymousId, text: '',
      attachments: ['bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'],
      clientMessageId: 'cross-case-attachment'
    })).ok, false);
    assert.equal((await emitAck(reporterA, 'message:send', {
      caseId: caseA.complaint.anonymousId, text: '',
      attachments: ['cccccccc-cccc-4ccc-8ccc-cccccccccccc'],
      clientMessageId: 'quarantine-attachment'
    })).ok, false);
    assert.ok(available);
    let rateLimited;
    for (let index = 0; index < 5; index += 1) {
      rateLimited = await emitAck(reporterA, 'message:send', {
        caseId: caseA.complaint.anonymousId,
        text: `bounded message ${index}`,
        clientMessageId: `bounded-rate-${index}`
      });
    }
    assert.equal(rateLimited.ok, false);
    assert.equal(rateLimited.code, 'CHAT_RATE_LIMITED');

    reporterA.close();
    const reconnected = await connect(url, {
      credentialType: 'reporter', token: reporterTokenA
    });
    sockets.push(reconnected);
    await emitAck(reconnected, 'case:join', { caseId: caseA.complaint.anonymousId });
    const history = await emitAck(reconnected, 'history:sync', {
      caseId: caseA.complaint.anonymousId, afterSequence: 0
    });
    assert.ok(history.messages.length >= 1);
    assert.equal(history.messages[0].sequence, 1);
    assert.equal((await emitAck(ngoSocket, 'message:read', {
      caseId: caseA.complaint.anonymousId, throughSequence: 1
    })).ok, true);
    assert.equal((await ChatMessage.findOne({ sequence: 1 }).lean()).deliveryState, 'read');

    let crossCaseTyping = false;
    reporterB.once('typing:changed', () => { crossCaseTyping = true; });
    ngoSocket.emit('typing:set', {
      caseId: caseA.complaint.anonymousId, state: true
    });
    await new Promise((resolve) => setTimeout(resolve, 100));
    assert.equal(crossCaseTyping, false);

    const revokedEvent = new Promise((resolve) => ngoSocket.once('access:revoked', resolve));
    await NgoAssignment.updateOne({ _id: assignment._id }, {
      state: 'withdrawn', isCurrent: false, withdrawnAt: new Date()
    });
    await revokeRealtimeComplaintAccess({
      complaintId: caseA.complaint.anonymousId, actorCategory: 'ngo'
    });
    await revokedEvent;
    assert.equal((await emitAck(ngoSocket, 'message:send', {
      caseId: caseA.complaint.anonymousId, text: 'must be denied',
      clientMessageId: 'revoked-message-001'
    })).ok, false);

    const stored = JSON.stringify(await ChatMessage.find({}).lean());
    for (const forbidden of [
      'private socket narrative', reporterTokenA, ngoToken,
      'https://example.invalid', 'socketId', '127.0.0.1'
    ]) assert.equal(stored.includes(forbidden), false);
  });
