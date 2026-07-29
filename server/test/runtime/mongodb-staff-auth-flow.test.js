import assert from 'node:assert/strict';
import http from 'node:http';
import test from 'node:test';
import mongoose from 'mongoose';

const runtimeUri = process.env.MONGODB_URI ?? '';
const databaseName = runtimeUri.match(/\/([^/?]+)(?:\?|$)/)?.[1] ?? '';
const runtimeEnabled = /^ss_p(?:[5789]|10)_rt_[a-z0-9_]+$/i.test(databaseName);
if (runtimeUri && !runtimeEnabled) {
  throw new Error('Phase 5 runtime test requires a dedicated ss_p5_rt_* database.');
}
process.env.EVIDENCE_ENCRYPTION_KEY ||= 'e'.repeat(64);
process.env.STAFF_ACCESS_TOKEN_SECRET ||= 'runtime-staff-access-secret-at-least-32-characters';
process.env.REFRESH_TOKEN_PEPPER ||= 'runtime-refresh-token-pepper-at-least-32-characters';
process.env.VERIFICATION_TOKEN_PEPPER ||= 'runtime-verification-pepper-at-least-32-characters';
process.env.PASSWORD_RESET_TOKEN_PEPPER ||= 'runtime-reset-pepper-at-least-32-characters';
process.env.MFA_CHALLENGE_TOKEN_PEPPER ||= 'runtime-mfa-challenge-pepper-at-least-32-characters';
process.env.RECOVERY_CODE_PEPPER ||= 'runtime-recovery-code-pepper-at-least-32-characters';
process.env.MFA_ENCRYPTION_KEY ||= 'f'.repeat(64);

const { default: app } = await import('../../src/app.js');
const { connectDatabase } = await import('../../src/config/db.js');
const { User } = await import('../../src/models/user.model.js');
const { Session } = await import('../../src/models/session.model.js');
const { AuthChallenge } = await import('../../src/models/auth-challenge.model.js');
const { RecoveryCode } = await import('../../src/models/recovery-code.model.js');
const { NGO } = await import('../../src/models/ngo.model.js');
const { Investigator } = await import('../../src/models/investigator.model.js');
const { hashPassword } = await import('../../src/services/password.service.js');
const {
  resetAuthDeliveryAdapter, setAuthDeliveryAdapter
} = await import('../../src/services/auth-delivery.service.js');
const { resendVerification } = await import('../../src/services/auth.service.js');
const { generateTOTP } = await import('../../src/utils/totp.js');

function cookiesFrom(response) {
  const values = response.headers.getSetCookie?.() || [response.headers.get('set-cookie')].filter(Boolean);
  return Object.fromEntries(values.map((value) => {
    const [pair] = value.split(';');
    const index = pair.indexOf('=');
    return [pair.slice(0, index), pair.slice(index + 1)];
  }));
}

function cookieHeader(jar) {
  return Object.entries(jar).map(([key, value]) => `${key}=${value}`).join('; ');
}

test('MongoDB-backed Phase 5 staff authentication lifecycle', { skip: !runtimeEnabled }, async (t) => {
  await connectDatabase();
  await mongoose.connection.dropDatabase();
  const captured = [];
  setAuthDeliveryAdapter({
    async deliver(item) {
      captured.push(item);
      return { state: 'sent' };
    }
  });
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}/api/v1`;
  t.after(async () => {
    resetAuthDeliveryAdapter();
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
    await new Promise((resolve) => server.close(resolve));
  });

  async function api(path, { method = 'GET', body, token, jar = {}, csrf } = {}) {
    const response = await fetch(`${base}${path}`, {
      method,
      headers: {
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(Object.keys(jar).length ? { Cookie: cookieHeader(jar) } : {}),
        ...(csrf ? { 'X-CSRF-Token': csrf } : {})
      },
      body: body ? JSON.stringify(body) : undefined
    });
    return {
      response,
      payload: await response.json(),
      cookies: cookiesFrom(response)
    };
  }

  const password = 'Runtime staff passphrase 2026!';
  const user = await User.create({
    name: 'Runtime Admin', email: 'p5-admin@example.invalid',
    passwordHash: await hashPassword(password), role: 'admin',
    isVerified: false, accountState: 'active'
  });

  const blocked = await api('/auth/login', {
    method: 'POST', body: { email: user.email, password }
  });
  assert.equal(blocked.response.status, 401);

  await resendVerification(user.email, null);
  const verifyToken = captured.at(-1).token;
  const challengeRecord = await AuthChallenge.findOne({ userId: user._id })
    .select('+tokenDigest').lean();
  assert.equal(challengeRecord.tokenDigest.includes(verifyToken), false);
  const verified = await api('/auth/verify-email', {
    method: 'POST', body: { token: verifyToken }
  });
  assert.equal(verified.response.status, 200);
  const verifyAgain = await api('/auth/verify-email', {
    method: 'POST', body: { token: verifyToken }
  });
  assert.equal(verifyAgain.response.status, 400);

  for (const role of ['ngo', 'investigator']) {
    const roleUser = await User.create({
      name: `Runtime ${role}`, email: `p5-${role}@example.invalid`,
      passwordHash: await hashPassword(password), role,
      isVerified: false, accountState: 'active'
    });
    if (role === 'ngo') {
      await NGO.create({
        userId: roleUser._id, name: 'Runtime NGO', email: roleUser.email,
        phone: 'test-only', city: 'Test City', district: 'Test District',
        verificationStatus: 'approved', profileVersion: 1, approvedProfileVersion: 1,
        operationalStatus: 'active', acceptsNewAssignments: true,
        supportedCategories: ['dowry_harassment'], remoteSupport: true
      });
    } else {
      await Investigator.create({
        userId: roleUser._id, name: 'Runtime Investigator',
        badgeNumber: 'P5-TEST-1', agency: 'Test Agency', phone: 'test-only',
        isActive: true, isEligible: true
      });
    }
    await resendVerification(roleUser.email, null);
    const roleToken = captured.at(-1).token;
    assert.equal((await api('/auth/verify-email', {
      method: 'POST', body: { token: roleToken }
    })).response.status, 200);
    const roleLogin = await api('/auth/login', {
      method: 'POST', body: { email: roleUser.email, password }
    });
    assert.equal(roleLogin.response.status, 200);
    assert.equal(roleLogin.payload.data.user.role, role);
  }

  const login = await api('/auth/login', {
    method: 'POST', body: { email: user.email, password }
  });
  assert.equal(login.response.status, 200);
  assert.equal(login.payload.data.refreshToken, undefined);
  let jar = login.cookies;
  let csrf = login.payload.data.csrfToken;
  let accessToken = login.payload.data.accessToken;
  assert.ok(jar.ss_refresh);
  assert.match(login.response.headers.get('set-cookie'), /HttpOnly/i);
  assert.equal(login.response.headers.get('set-cookie').includes('SameSite=Strict'), true);

  const csrfDenied = await api('/auth/refresh', { method: 'POST', jar });
  assert.equal(csrfDenied.response.status, 403);

  const firstRefreshCookie = jar.ss_refresh;
  const rotated = await api('/auth/refresh', { method: 'POST', jar, csrf });
  assert.equal(rotated.response.status, 200);
  jar = { ...jar, ...rotated.cookies };
  csrf = rotated.payload.data.csrfToken;
  accessToken = rotated.payload.data.accessToken;
  const rawSessions = await mongoose.connection.collection('sessions').find({}).toArray();
  assert.equal(JSON.stringify(rawSessions).includes(firstRefreshCookie), false);
  assert.ok(rawSessions.every((session) => !session.ipAddress && !session.userAgent));

  const reused = await api('/auth/refresh', {
    method: 'POST', jar: { ...jar, ss_refresh: firstRefreshCookie }, csrf
  });
  assert.equal(reused.response.status, 401);
  const rotatedFamily = rawSessions.find((session) =>
    String(session.userId) === String(user._id) && session.status === 'consumed'
  ).familyId;
  assert.equal(await Session.countDocuments({ familyId: rotatedFamily, status: 'active' }), 0);

  const loginForMfa = await api('/auth/login', {
    method: 'POST', body: { email: user.email, password }
  });
  jar = loginForMfa.cookies;
  csrf = loginForMfa.payload.data.csrfToken;
  accessToken = loginForMfa.payload.data.accessToken;
  const enrollment = await api('/auth/mfa/setup', { method: 'POST', token: accessToken });
  const secret = enrollment.payload.data.manualSecret;
  const enabled = await api('/auth/mfa/enable', {
    method: 'POST', token: accessToken, body: { code: generateTOTP(secret) }
  });
  assert.equal(enabled.response.status, 200);
  const recoveryCodes = enabled.payload.recoveryCodes || enabled.payload.data?.recoveryCodes;
  assert.equal(recoveryCodes.length, 10);
  const storedUser = await mongoose.connection.collection('users').findOne({ _id: user._id });
  assert.equal(storedUser.mfaSecretEncrypted.includes(secret), false);
  const recoveryRecords = await RecoveryCode.find({ userId: user._id }).select('+codeDigest').lean();
  assert.equal(JSON.stringify(recoveryRecords).includes(recoveryCodes[0]), false);

  await User.updateOne({ _id: user._id }, { mfaLastAcceptedStep: null });
  const totpLogin = await api('/auth/login', {
    method: 'POST', body: { email: user.email, password }
  });
  const currentTotp = generateTOTP(secret);
  const totpAccepted = await api('/auth/login/mfa', {
    method: 'POST',
    body: { challengeToken: totpLogin.payload.data.challengeToken, code: currentTotp }
  });
  assert.equal(totpAccepted.response.status, 200);
  const replayChallenge = await api('/auth/login', {
    method: 'POST', body: { email: user.email, password }
  });
  const replayTotp = await api('/auth/login/mfa', {
    method: 'POST',
    body: { challengeToken: replayChallenge.payload.data.challengeToken, code: currentTotp }
  });
  assert.equal(replayTotp.response.status, 401);

  const mfaLogin = await api('/auth/login', {
    method: 'POST', body: { email: user.email, password }
  });
  assert.equal(mfaLogin.payload.data.mfaRequired, true);
  const recoveryLogin = await api('/auth/login/mfa', {
    method: 'POST',
    body: { challengeToken: mfaLogin.payload.data.challengeToken, recoveryCode: recoveryCodes[0] }
  });
  assert.equal(recoveryLogin.response.status, 200);
  const safeSessions = await api('/auth/sessions', {
    token: recoveryLogin.payload.data.accessToken
  });
  assert.equal(safeSessions.response.status, 200);
  assert.ok(safeSessions.payload.data.sessions.length >= 2);
  for (const session of safeSessions.payload.data.sessions) {
    assert.deepEqual(
      Object.keys(session).sort(),
      ['createdAt', 'current', 'deviceCategory', 'label', 'lastUsedAt', 'sessionId'].sort()
    );
  }
  const selected = safeSessions.payload.data.sessions.find((session) => !session.current);
  const selectedRevoked = await api(`/auth/sessions/${selected.sessionId}`, {
    method: 'DELETE', token: recoveryLogin.payload.data.accessToken
  });
  assert.equal(selectedRevoked.response.status, 200);
  assert.equal(await Session.countDocuments({ sessionId: selected.sessionId, status: 'active' }), 0);
  const othersRevoked = await api('/auth/sessions/logout-others', {
    method: 'POST', token: recoveryLogin.payload.data.accessToken
  });
  assert.equal(othersRevoked.response.status, 200);
  const secondChallenge = await api('/auth/login', {
    method: 'POST', body: { email: user.email, password }
  });
  const reusedRecovery = await api('/auth/login/mfa', {
    method: 'POST',
    body: { challengeToken: secondChallenge.payload.data.challengeToken, recoveryCode: recoveryCodes[0] }
  });
  assert.equal(reusedRecovery.response.status, 401);

  const regenerated = await api('/auth/mfa/recovery/regenerate', {
    method: 'POST',
    token: recoveryLogin.payload.data.accessToken,
    body: { currentPassword: password, recoveryCode: recoveryCodes[2] }
  });
  assert.equal(regenerated.response.status, 200);
  const replacementCodes = regenerated.payload.data.recoveryCodes;
  assert.equal(replacementCodes.length, 10);
  const oldCodeChallenge = await api('/auth/login', {
    method: 'POST', body: { email: user.email, password }
  });
  const invalidatedOldCode = await api('/auth/login/mfa', {
    method: 'POST',
    body: {
      challengeToken: oldCodeChallenge.payload.data.challengeToken,
      recoveryCode: recoveryCodes[3]
    }
  });
  assert.equal(invalidatedOldCode.response.status, 401);
  const newCodeChallenge = await api('/auth/login', {
    method: 'POST', body: { email: user.email, password }
  });
  const replacementLogin = await api('/auth/login/mfa', {
    method: 'POST',
    body: {
      challengeToken: newCodeChallenge.payload.data.challengeToken,
      recoveryCode: replacementCodes[0]
    }
  });
  assert.equal(replacementLogin.response.status, 200);
  const disabledMfa = await api('/auth/mfa/disable', {
    method: 'POST',
    token: replacementLogin.payload.data.accessToken,
    body: { currentPassword: password, recoveryCode: replacementCodes[1] }
  });
  assert.equal(disabledMfa.response.status, 200);
  assert.equal(await Session.countDocuments({ userId: user._id, status: 'active' }), 0);
  const loginAfterDisable = await api('/auth/login', {
    method: 'POST', body: { email: user.email, password }
  });
  assert.equal(loginAfterDisable.response.status, 200);
  assert.equal(loginAfterDisable.payload.data.mfaRequired, undefined);
  const logoutAllResult = await api('/auth/sessions/logout-all', {
    method: 'POST', token: loginAfterDisable.payload.data.accessToken
  });
  assert.equal(logoutAllResult.response.status, 200);
  assert.equal(await Session.countDocuments({ userId: user._id, status: 'active' }), 0);

  await User.updateOne({ _id: user._id }, { accountState: 'disabled' });
  const disabledLogin = await api('/auth/login', {
    method: 'POST', body: { email: user.email, password }
  });
  assert.equal(disabledLogin.response.status, 401);
  const disabledRefresh = await api('/auth/refresh', {
    method: 'POST',
    jar: recoveryLogin.cookies,
    csrf: recoveryLogin.payload.data.csrfToken
  });
  assert.equal(disabledRefresh.response.status, 401);
  await User.updateOne({ _id: user._id }, { accountState: 'active' });

  const resetRequestKnown = await api('/auth/forgot-password', {
    method: 'POST', body: { email: user.email }
  });
  const resetRequestUnknown = await api('/auth/forgot-password', {
    method: 'POST', body: { email: 'unknown@example.invalid' }
  });
  assert.equal(resetRequestKnown.payload.message, resetRequestUnknown.payload.message);
  const resetToken = captured.at(-1).token;
  const reset = await api('/auth/reset-password', {
    method: 'POST', body: { token: resetToken, newPassword: 'A new runtime passphrase 2026!' }
  });
  assert.equal(reset.response.status, 200);
  assert.equal(await Session.countDocuments({ userId: user._id, status: 'active' }), 0);
  const resetAgain = await api('/auth/reset-password', {
    method: 'POST', body: { token: resetToken, newPassword: 'Another runtime passphrase 2026!' }
  });
  assert.equal(resetAgain.response.status, 400);

  const databaseJson = JSON.stringify({
    users: await mongoose.connection.collection('users').find({}).toArray(),
    sessions: await mongoose.connection.collection('sessions').find({}).toArray(),
    challenges: await mongoose.connection.collection('authchallenges').find({}).toArray(),
    recovery: await mongoose.connection.collection('recoverycodes').find({}).toArray()
  });
  for (const raw of [
    verifyToken, resetToken, firstRefreshCookie, secret, ...recoveryCodes, ...replacementCodes
  ]) {
    assert.equal(databaseJson.includes(raw), false);
  }
});
