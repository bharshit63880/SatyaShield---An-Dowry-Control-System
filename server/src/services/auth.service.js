import crypto from 'crypto';
import { env } from '../config/env.js';
import { User } from '../models/user.model.js';
import { Session } from '../models/session.model.js';
import { AuthChallenge } from '../models/auth-challenge.model.js';
import { RecoveryCode } from '../models/recovery-code.model.js';
import { NGO } from '../models/ngo.model.js';
import { Investigator } from '../models/investigator.model.js';
import { ApiError } from '../utils/ApiError.js';
import { signAccessToken } from '../utils/jwt.js';
import {
  decryptMfaSecret, digestAuthValue, encryptMfaSecret, randomOpaqueToken
} from '../utils/auth-crypto.js';
import { generateBase32Secret, verifyTOTPWithStep } from '../utils/totp.js';
import {
  assertPasswordPolicy, hashPassword, passwordNeedsRehash, verifyPassword
} from './password.service.js';
import { createAuditLog } from './audit.service.js';
import { deliverAuthChallenge } from './auth-delivery.service.js';
import { logEvent } from './logger.service.js';

const GENERIC_DELIVERY_MESSAGE =
  'If the account is eligible, instructions were queued. Delivery may be unavailable in this environment.';

function deviceCategory(req) {
  const value = String(req?.headers?.['user-agent'] || '').toLowerCase();
  if (!value) return 'unknown';
  if (/ipad|tablet|kindle|silk/.test(value)) return 'tablet';
  if (/mobile|android|iphone|ipod/.test(value)) return 'mobile';
  return 'desktop';
}

function challengeConfig(purpose) {
  if (purpose === 'email_verification') {
    return { minutes: env.verificationTokenExpiresMinutes, pepper: 'email_verification' };
  }
  if (purpose === 'password_reset') {
    return { minutes: env.passwordResetTokenExpiresMinutes, pepper: 'password_reset' };
  }
  return { minutes: env.mfaChallengeExpiresMinutes, pepper: 'mfa_login' };
}

async function issueChallenge(user, purpose, { deliver = true } = {}) {
  const config = challengeConfig(purpose);
  await AuthChallenge.updateMany(
    { userId: user._id, purpose, status: 'active' },
    { status: 'revoked', revokedAt: new Date() }
  );
  const token = randomOpaqueToken();
  const challenge = await AuthChallenge.create({
    userId: user._id,
    purpose,
    tokenDigest: digestAuthValue(token, config.pepper),
    expiresAt: new Date(Date.now() + config.minutes * 60000),
    maxAttempts: purpose === 'mfa_login' ? 6 : 3,
    deliveryState: deliver ? 'queued' : 'not_applicable'
  });
  if (deliver) {
    const delivery = await deliverAuthChallenge({ purpose, recipient: user.email, token });
    challenge.deliveryState = delivery.state;
    await challenge.save();
  }
  return { token, challenge };
}

async function consumeChallenge(token, purpose) {
  const { pepper } = challengeConfig(purpose);
  const digest = digestAuthValue(token, pepper);
  const challenge = await AuthChallenge.findOne({ tokenDigest: digest }).select('+tokenDigest');
  if (
    !challenge || challenge.purpose !== purpose || challenge.status !== 'active' ||
    challenge.expiresAt <= new Date()
  ) throw new ApiError(400, 'Authentication challenge is invalid or expired.', {
    code: 'AUTH_CHALLENGE_INVALID'
  });
  const consumed = await AuthChallenge.findOneAndUpdate(
    { _id: challenge._id, status: 'active' },
    { status: 'used', usedAt: new Date() },
    { new: true }
  );
  if (!consumed) throw new ApiError(400, 'Authentication challenge is invalid or expired.', {
    code: 'AUTH_CHALLENGE_INVALID'
  });
  return consumed;
}

async function enforceRoleState(user) {
  if (!user.isVerified || user.accountState !== 'active') {
    throw new ApiError(401, 'Account is unavailable.', { code: 'AUTH_ACCOUNT_UNAVAILABLE' });
  }
  if (user.role === 'ngo') {
    const ngo = await NGO.findOne({ userId: user._id }).lean();
    if (
      !ngo ||
      ngo.verificationStatus !== 'approved' ||
      ngo.operationalStatus !== 'active' ||
      ngo.profileVersion !== ngo.approvedProfileVersion
    ) {
      throw new ApiError(401, 'Account is unavailable.', { code: 'AUTH_ACCOUNT_UNAVAILABLE' });
    }
  }
  if (user.role === 'investigator') {
    const investigator = await Investigator.findOne({ userId: user._id }).lean();
    if (!investigator?.isActive || !investigator?.isEligible) {
      throw new ApiError(401, 'Account is unavailable.', { code: 'AUTH_ACCOUNT_UNAVAILABLE' });
    }
  }
}

function sessionPayload(user, session) {
  return {
    accessToken: signAccessToken({
      subject: user.id,
      role: user.role,
      sessionId: session.sessionId,
      authVersion: user.authVersion
    }),
    user: {
      id: user.id, email: user.email, role: user.role, name: user.name,
      mfaEnabled: user.mfaEnabled
    }
  };
}

async function createSession(user, req, familyId = crypto.randomUUID()) {
  const refreshToken = randomOpaqueToken(48);
  const session = await Session.create({
    userId: user._id,
    sessionId: crypto.randomUUID(),
    familyId,
    tokenDigest: digestAuthValue(refreshToken, 'refresh'),
    deviceCategory: deviceCategory(req),
    label: `${deviceCategory(req)} session`,
    authVersion: user.authVersion,
    expiresAt: new Date(Date.now() + env.refreshTokenExpiresDays * 86400000)
  });
  return { refreshToken, session };
}

export async function registerUser({ name, email, password, role = 'user' }, req) {
  const normalizedEmail = email.toLowerCase().trim();
  if (await User.exists({ email: normalizedEmail })) {
    return { deliveryState: 'skipped_not_configured' };
  }
  const user = await User.create({
    name, email: normalizedEmail, passwordHash: await hashPassword(password),
    role, isVerified: false, accountState: 'active'
  });
  const { challenge } = await issueChallenge(user, 'email_verification');
  await createAuditLog({
    userId: user.id, role: user.role, action: 'verification_challenge_created',
    resourceType: 'account', outcome: 'allowed', req
  });
  return { deliveryState: challenge.deliveryState };
}

export async function resendVerification(email, req) {
  const user = await User.findOne({ email: String(email).toLowerCase().trim() });
  let state = 'skipped_not_configured';
  if (user && !user.isVerified && user.accountState === 'active') {
    const { challenge } = await issueChallenge(user, 'email_verification');
    state = challenge.deliveryState;
  }
  return { success: true, message: GENERIC_DELIVERY_MESSAGE, deliveryState: state };
}

export async function verifyEmail(token, req) {
  const challenge = await consumeChallenge(token, 'email_verification');
  const user = await User.findByIdAndUpdate(
    challenge.userId,
    { isVerified: true },
    { new: true }
  );
  await createAuditLog({
    userId: user.id, role: user.role, action: 'email_verified',
    resourceType: 'account', outcome: 'allowed', req
  });
  return { success: true, message: 'Email verification completed. Sign in to continue.' };
}

export async function loginUser({ email, password }, req) {
  const user = await User.findOne({ email: email.toLowerCase().trim() })
    .select('+mfaSecretEncrypted +passwordHash');
  const valid = user ? await verifyPassword(password, user.passwordHash) : false;
  if (!valid) {
    await createAuditLog({ role: user?.role || 'guest', userId: user?.id, action: 'login_failure',
      resourceType: 'account', outcome: 'denied', errorCode: 'AUTH_INVALID_CREDENTIALS', req });
    throw new ApiError(401, 'Invalid email or password.', { code: 'AUTH_INVALID_CREDENTIALS' });
  }
  await enforceRoleState(user);
  if (passwordNeedsRehash(user.passwordHash)) {
    user.passwordHash = await hashPassword(password);
    await user.save();
  }
  if (user.mfaEnabled) {
    const { token, challenge } = await issueChallenge(user, 'mfa_login', { deliver: false });
    await createAuditLog({ userId: user.id, role: user.role, action: 'mfa_challenge_created',
      resourceType: 'account', outcome: 'allowed', req });
    return { mfaRequired: true, challengeToken: token, expiresAt: challenge.expiresAt };
  }
  const created = await createSession(user, req);
  await createAuditLog({ userId: user.id, role: user.role, action: 'login_succeeded',
    resourceType: 'session', resourceRef: created.session.sessionId, outcome: 'allowed', req });
  return { ...sessionPayload(user, created.session), refreshToken: created.refreshToken };
}

async function consumeRecoveryCode(userId, code) {
  const digest = digestAuthValue(String(code).toUpperCase().replace(/[^A-Z0-9]/g, ''), 'recovery');
  return RecoveryCode.findOneAndUpdate(
    { userId, codeDigest: digest, usedAt: null, revokedAt: null },
    { usedAt: new Date() },
    { new: true }
  ).select('+codeDigest');
}

export async function verifyLoginMfa({ challengeToken, code, recoveryCode }, req) {
  const digest = digestAuthValue(challengeToken, 'mfa_login');
  const challenge = await AuthChallenge.findOne({ tokenDigest: digest }).select('+tokenDigest');
  if (!challenge || challenge.purpose !== 'mfa_login' || challenge.status !== 'active' ||
      challenge.expiresAt <= new Date() || challenge.attempts >= challenge.maxAttempts) {
    throw new ApiError(401, 'MFA challenge is invalid or expired.', { code: 'MFA_CHALLENGE_INVALID' });
  }
  const user = await User.findById(challenge.userId)
    .select('+mfaSecretEncrypted +mfaLastAcceptedStep');
  await enforceRoleState(user);
  let accepted = false;
  let recoveryUsed = false;
  if (recoveryCode) {
    accepted = Boolean(await consumeRecoveryCode(user._id, recoveryCode));
    recoveryUsed = accepted;
  } else {
    const verification = verifyTOTPWithStep(code, decryptMfaSecret(user.mfaSecretEncrypted), { window: 1 });
    accepted = verification.valid &&
      (user.mfaLastAcceptedStep === null || verification.step > user.mfaLastAcceptedStep);
    if (accepted) user.mfaLastAcceptedStep = verification.step;
  }
  if (!accepted) {
    challenge.attempts += 1;
    if (challenge.attempts >= challenge.maxAttempts) {
      challenge.status = 'revoked';
      challenge.revokedAt = new Date();
    }
    await challenge.save();
    throw new ApiError(401, 'MFA code is invalid.', { code: 'MFA_CODE_INVALID' });
  }
  challenge.status = 'used';
  challenge.usedAt = new Date();
  await Promise.all([challenge.save(), user.save()]);
  const created = await createSession(user, req);
  await createAuditLog({ userId: user.id, role: user.role,
    action: recoveryUsed ? 'recovery_code_used' : 'mfa_succeeded',
    resourceType: 'session', resourceRef: created.session.sessionId, outcome: 'allowed', req });
  return { ...sessionPayload(user, created.session), refreshToken: created.refreshToken };
}

export async function rotateRefreshToken(token, req) {
  const digest = digestAuthValue(token || '', 'refresh');
  const existing = await Session.findOne({ tokenDigest: digest }).select('+tokenDigest');
  if (!existing) throw new ApiError(401, 'Session is invalid or expired.', { code: 'SESSION_INVALID' });
  if (existing.status !== 'active') {
    await Session.updateMany(
      { familyId: existing.familyId, status: { $ne: 'revoked' } },
      { status: 'revoked', revokedAt: new Date(), revokeReason: 'refresh_reuse' }
    );
    logEvent('warn', 'refresh_reuse_detected', { outcome: 'family_revoked' });
    throw new ApiError(401, 'Session is invalid or expired.', { code: 'SESSION_INVALID' });
  }
  const consumed = await Session.findOneAndUpdate(
    { _id: existing._id, status: 'active' },
    { status: 'consumed', consumedAt: new Date(), lastUsedAt: new Date() },
    { new: true }
  );
  if (!consumed) {
    await Session.updateMany({ familyId: existing.familyId }, {
      status: 'revoked', revokedAt: new Date(), revokeReason: 'concurrent_refresh'
    });
    throw new ApiError(401, 'Session is invalid or expired.', { code: 'SESSION_INVALID' });
  }
  const user = await User.findById(existing.userId);
  await enforceRoleState(user);
  if (existing.authVersion !== user.authVersion || existing.expiresAt <= new Date()) {
    await revokeFamily(existing.familyId, 'account_changed');
    throw new ApiError(401, 'Session is invalid or expired.', { code: 'SESSION_INVALID' });
  }
  const created = await createSession(user, req, existing.familyId);
  await createAuditLog({ userId: user.id, role: user.role, action: 'refresh_rotated',
    resourceType: 'session', resourceRef: created.session.sessionId, outcome: 'allowed', req });
  return { ...sessionPayload(user, created.session), refreshToken: created.refreshToken };
}

async function revokeFamily(familyId, reason) {
  await Session.updateMany(
    { familyId, status: { $ne: 'revoked' } },
    { status: 'revoked', revokedAt: new Date(), revokeReason: reason }
  );
}

export async function logoutSession(token, req) {
  if (token) {
    const session = await Session.findOne({ tokenDigest: digestAuthValue(token, 'refresh') })
      .select('+tokenDigest');
    if (session) await revokeFamily(session.familyId, 'logout');
  }
  return { success: true };
}

export async function requestPasswordReset(email, req) {
  const user = await User.findOne({ email: String(email).toLowerCase().trim() });
  let state = 'skipped_not_configured';
  if (user && user.accountState === 'active') {
    const { challenge } = await issueChallenge(user, 'password_reset');
    state = challenge.deliveryState;
  }
  return { success: true, message: GENERIC_DELIVERY_MESSAGE, deliveryState: state };
}

export async function resetPassword({ token, newPassword }, req) {
  assertPasswordPolicy(newPassword);
  const challenge = await consumeChallenge(token, 'password_reset');
  const user = await User.findById(challenge.userId);
  user.passwordHash = await hashPassword(newPassword);
  user.passwordChangedAt = new Date();
  user.authVersion += 1;
  await user.save();
  await Promise.all([
    Session.updateMany({ userId: user._id, status: { $ne: 'revoked' } },
      { status: 'revoked', revokedAt: new Date(), revokeReason: 'password_reset' }),
    AuthChallenge.updateMany({ userId: user._id, purpose: 'mfa_login', status: 'active' },
      { status: 'revoked', revokedAt: new Date() })
  ]);
  await createAuditLog({ userId: user.id, role: user.role, action: 'password_reset_completed',
    resourceType: 'account', outcome: 'allowed', req });
  return { success: true, message: 'Password reset completed. Sign in again.' };
}

export async function changePassword(userId, proof, req) {
  const { currentPassword, newPassword } = proof;
  const user = await User.findById(userId)
    .select('+passwordHash +mfaSecretEncrypted +mfaLastAcceptedStep');
  if (!await verifyPassword(currentPassword, user.passwordHash)) {
    throw new ApiError(401, 'Current password is incorrect.', { code: 'AUTH_REAUTH_FAILED' });
  }
  if (user.mfaEnabled) {
    await requireSecondFactor(user, proof);
  }
  user.passwordHash = await hashPassword(newPassword);
  user.passwordChangedAt = new Date();
  user.authVersion += 1;
  await user.save();
  await Session.updateMany({ userId, status: { $ne: 'revoked' } },
    { status: 'revoked', revokedAt: new Date(), revokeReason: 'password_change' });
  await createAuditLog({ userId, role: user.role, action: 'password_changed',
    resourceType: 'account', outcome: 'allowed', req });
  return { success: true, message: 'Password changed. Sign in again.' };
}

export async function setupMfa(userId) {
  const user = await User.findById(userId).select('+mfaPendingSecretEncrypted');
  const secret = generateBase32Secret(32);
  user.mfaPendingSecretEncrypted = encryptMfaSecret(secret);
  await user.save();
  return {
    manualSecret: secret,
    otpauthUrl: `otpauth://totp/SatyaShield:${encodeURIComponent(user.email)}?secret=${secret}&issuer=SatyaShield`
  };
}

export async function enableMfa(userId, code, req) {
  const user = await User.findById(userId)
    .select('+mfaPendingSecretEncrypted +mfaSecretEncrypted +mfaLastAcceptedStep');
  if (!user.mfaPendingSecretEncrypted) {
    throw new ApiError(400, 'MFA enrollment is not pending.', { code: 'MFA_ENROLLMENT_MISSING' });
  }
  const secret = decryptMfaSecret(user.mfaPendingSecretEncrypted);
  const result = verifyTOTPWithStep(code, secret, { window: 1 });
  if (!result.valid) throw new ApiError(400, 'MFA code is invalid.', { code: 'MFA_CODE_INVALID' });
  user.mfaSecretEncrypted = encryptMfaSecret(secret);
  user.mfaPendingSecretEncrypted = null;
  user.mfaLastAcceptedStep = result.step;
  user.mfaEnabled = true;
  user.mfaEnrolledAt = new Date();
  await user.save();
  const recoveryCodes = await regenerateRecoveryCodes(userId);
  await createAuditLog({ userId, role: user.role, action: 'mfa_enabled',
    resourceType: 'account', outcome: 'allowed', req });
  return { success: true, recoveryCodes };
}

export async function regenerateRecoveryCodes(userId) {
  const generationId = crypto.randomUUID();
  await RecoveryCode.updateMany({ userId, usedAt: null, revokedAt: null }, { revokedAt: new Date() });
  const codes = Array.from({ length: 10 }, () => {
    const raw = crypto.randomBytes(10).toString('hex').toUpperCase();
    return `${raw.slice(0, 5)}-${raw.slice(5, 10)}-${raw.slice(10, 15)}-${raw.slice(15)}`;
  });
  await RecoveryCode.insertMany(codes.map((code) => ({
    userId, generationId,
    codeDigest: digestAuthValue(code.replace(/-/g, ''), 'recovery')
  })));
  return codes;
}

async function requireSecondFactor(user, { code, recoveryCode }) {
  if (recoveryCode && await consumeRecoveryCode(user._id, recoveryCode)) return;
  if (!code || !user.mfaSecretEncrypted) {
    throw new ApiError(401, 'Recent MFA verification is required.', { code: 'MFA_REQUIRED' });
  }
  const result = verifyTOTPWithStep(code, decryptMfaSecret(user.mfaSecretEncrypted), { window: 1 });
  if (!result.valid || (user.mfaLastAcceptedStep !== null && result.step <= user.mfaLastAcceptedStep)) {
    throw new ApiError(401, 'MFA code is invalid.', { code: 'MFA_CODE_INVALID' });
  }
  user.mfaLastAcceptedStep = result.step;
  await user.save();
}

export async function regenerateRecoveryCodesSecure(
  userId, { currentPassword, code, recoveryCode }, req
) {
  const user = await User.findById(userId)
    .select('+passwordHash +mfaSecretEncrypted +mfaLastAcceptedStep');
  if (!await verifyPassword(currentPassword, user.passwordHash)) {
    throw new ApiError(401, 'Recent authentication is required.', { code: 'AUTH_REAUTH_FAILED' });
  }
  await requireSecondFactor(user, { code, recoveryCode });
  const recoveryCodes = await regenerateRecoveryCodes(userId);
  await createAuditLog({ userId, role: user.role, action: 'recovery_codes_regenerated',
    resourceType: 'account', outcome: 'allowed', req });
  return recoveryCodes;
}

export async function disableMfa(userId, proof, req) {
  const user = await User.findById(userId)
    .select('+passwordHash +mfaSecretEncrypted +mfaLastAcceptedStep');
  if (!await verifyPassword(proof.currentPassword, user.passwordHash)) {
    throw new ApiError(401, 'Recent authentication is required.', { code: 'AUTH_REAUTH_FAILED' });
  }
  await requireSecondFactor(user, proof);
  user.mfaEnabled = false;
  user.mfaSecretEncrypted = null;
  user.mfaPendingSecretEncrypted = null;
  user.mfaLastAcceptedStep = null;
  user.authVersion += 1;
  await user.save();
  await Promise.all([
    RecoveryCode.updateMany({ userId, revokedAt: null }, { revokedAt: new Date() }),
    Session.updateMany({ userId, status: { $ne: 'revoked' } },
      { status: 'revoked', revokedAt: new Date(), revokeReason: 'mfa_disabled' })
  ]);
  await createAuditLog({ userId, role: user.role, action: 'mfa_disabled',
    resourceType: 'account', outcome: 'allowed', req });
  return { success: true, message: 'MFA disabled. Sign in again.' };
}

export async function listUserSessions(userId, currentSessionId) {
  const sessions = await Session.find({ userId, status: 'active', expiresAt: { $gt: new Date() } })
    .sort({ createdAt: -1 }).lean();
  return sessions.map((session) => ({
    sessionId: session.sessionId,
    label: session.label,
    deviceCategory: session.deviceCategory,
    createdAt: session.createdAt,
    lastUsedAt: session.lastUsedAt,
    current: session.sessionId === currentSessionId
  }));
}

export async function revokeUserSession(userId, sessionId) {
  const session = await Session.findOne({ userId, sessionId });
  if (session) await revokeFamily(session.familyId, 'selected_session_revoked');
  return { success: true };
}

export async function revokeAllSessions(userId, exceptSessionId = null) {
  const query = { userId, status: { $ne: 'revoked' } };
  if (exceptSessionId) query.sessionId = { $ne: exceptSessionId };
  await Session.updateMany(query, {
    status: 'revoked', revokedAt: new Date(),
    revokeReason: exceptSessionId ? 'logout_others' : 'logout_all'
  });
  return { success: true };
}

// Startup no longer mutates privileged accounts.
export async function ensureAdminUser() {}
