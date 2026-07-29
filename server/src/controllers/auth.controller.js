import crypto from 'crypto';
import { env } from '../config/env.js';
import {
  changePassword, disableMfa as disableMfaService, enableMfa as enableMfaService, listUserSessions, loginUser,
  logoutSession, regenerateRecoveryCodesSecure, registerUser, requestPasswordReset,
  resendVerification, resetPassword as resetPasswordService, revokeAllSessions,
  revokeUserSession, rotateRefreshToken, setupMfa as setupMfaService,
  verifyEmail as verifyEmailService, verifyLoginMfa
} from '../services/auth.service.js';
import { authCookieOptions, readCookie } from '../middlewares/csrf.middleware.js';
import { asyncHandler } from '../utils/asyncHandler.js';

function attachSessionCookies(res, refreshToken) {
  const csrfToken = crypto.randomBytes(24).toString('base64url');
  res.cookie(env.authCookieName, refreshToken, authCookieOptions({ httpOnly: true }));
  res.cookie(env.csrfCookieName, csrfToken, authCookieOptions({ httpOnly: false }));
  return csrfToken;
}

function clearSessionCookies(res) {
  const { maxAge: _refreshMaxAge, ...refreshOptions } = authCookieOptions({ httpOnly: true });
  const { maxAge: _csrfMaxAge, ...csrfOptions } = authCookieOptions({ httpOnly: false });
  res.clearCookie(env.authCookieName, refreshOptions);
  res.clearCookie(env.csrfCookieName, csrfOptions);
}

function sessionResponse(res, result, message) {
  const { refreshToken, ...safe } = result;
  const csrfToken = attachSessionCookies(res, refreshToken);
  return res.status(200).json({ success: true, message, data: { ...safe, csrfToken } });
}

export const register = asyncHandler(async (req, res) => {
  const result = await registerUser(req.validated.registration, req);
  res.status(202).json({
    success: true,
    message: 'If registration is eligible, verification instructions were queued.',
    data: result
  });
});

export const resendVerificationController = asyncHandler(async (req, res) => {
  res.status(200).json(await resendVerification(req.body.email, req));
});

export const verifyEmail = asyncHandler(async (req, res) => {
  res.status(200).json(await verifyEmailService(req.body.token, req));
});

export const login = asyncHandler(async (req, res) => {
  const result = await loginUser(req.validated.auth, req);
  if (result.mfaRequired) {
    return res.status(200).json({
      success: true, message: 'MFA is required.', data: result
    });
  }
  return sessionResponse(res, result, 'Login successful.');
});

export const verifyMfa = asyncHandler(async (req, res) => {
  const result = await verifyLoginMfa(req.body, req);
  return sessionResponse(res, result, 'MFA verified successfully.');
});

export const refresh = asyncHandler(async (req, res) => {
  const result = await rotateRefreshToken(readCookie(req, env.authCookieName), req);
  return sessionResponse(res, result, 'Session refreshed.');
});

export const logout = asyncHandler(async (req, res) => {
  await logoutSession(readCookie(req, env.authCookieName), req);
  clearSessionCookies(res);
  res.status(200).json({ success: true, message: 'Logged out.' });
});

export const forgotPassword = asyncHandler(async (req, res) => {
  res.status(200).json(await requestPasswordReset(req.validated.forgotPassword.email, req));
});

export const resetPassword = asyncHandler(async (req, res) => {
  res.status(200).json(await resetPasswordService(req.validated.resetPassword, req));
});

export const passwordChange = asyncHandler(async (req, res) => {
  const result = await changePassword(req.user.id, req.body, req);
  clearSessionCookies(res);
  res.status(200).json(result);
});

export const getCurrentUser = asyncHandler(async (req, res) => {
  res.status(200).json({ success: true, data: { user: {
    id: req.user.id, name: req.user.name, email: req.user.email, role: req.user.role,
    mfaEnabled: req.user.mfaEnabled, isVerified: req.user.isVerified,
    accountState: req.user.accountState
  } } });
});

export const setupMfa = asyncHandler(async (req, res) => {
  res.status(200).json({ success: true, data: await setupMfaService(req.user.id) });
});

export const enableMfa = asyncHandler(async (req, res) => {
  res.status(200).json(await enableMfaService(req.user.id, req.validated.mfaEnable.code, req));
});

export const regenerateRecovery = asyncHandler(async (req, res) => {
  res.status(200).json({ success: true, data: {
    recoveryCodes: await regenerateRecoveryCodesSecure(req.user.id, req.body, req)
  } });
});

export const disableMfa = asyncHandler(async (req, res) => {
  const result = await disableMfaService(req.user.id, req.body, req);
  clearSessionCookies(res);
  res.status(200).json(result);
});

export const getSessions = asyncHandler(async (req, res) => {
  res.status(200).json({ success: true, data: {
    sessions: await listUserSessions(req.user.id, req.staffSessionId)
  } });
});

export const revokeSession = asyncHandler(async (req, res) => {
  await revokeUserSession(req.user.id, req.params.id);
  res.status(200).json({ success: true, message: 'Session revoked.' });
});

export const logoutOthers = asyncHandler(async (req, res) => {
  await revokeAllSessions(req.user.id, req.staffSessionId);
  res.status(200).json({ success: true, message: 'Other sessions revoked.' });
});

export const logoutAll = asyncHandler(async (req, res) => {
  await revokeAllSessions(req.user.id);
  clearSessionCookies(res);
  res.status(200).json({ success: true, message: 'All sessions revoked.' });
});
