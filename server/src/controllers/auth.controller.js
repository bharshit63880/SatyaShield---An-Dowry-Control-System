import {
  registerUser,
  verifyEmail as verifyEmailService,
  loginUser,
  verifyLoginMfa,
  rotateRefreshToken,
  logoutSession,
  requestPasswordReset,
  resetPassword as resetPasswordService,
  setupMfa as setupMfaService,
  enableMfa as enableMfaService,
  listUserSessions,
  revokeUserSession
} from '../services/auth.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const register = asyncHandler(async (req, res) => {
  const result = await registerUser(req.validated.registration, req);
  res.status(201).json({
    success: true,
    message: 'User registered successfully. Verification email logged to console.',
    data: result
  });
});

export const verifyEmail = asyncHandler(async (req, res) => {
  const { token } = req.query;
  const result = await verifyEmailService(token, req);
  res.status(200).json(result);
});

export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.validated.auth;
  const result = await loginUser({ email, password }, req);
  
  res.status(200).json({
    success: true,
    message: result.mfaRequired ? 'MFA code is required to complete login.' : 'Login successful.',
    data: result
  });
});

export const verifyMfa = asyncHandler(async (req, res) => {
  const { userId, mfaToken, code } = req.validated.mfaVerify;
  const result = await verifyLoginMfa({ userId, mfaToken, code }, req);

  res.status(200).json({
    success: true,
    message: 'MFA verified successfully.',
    data: result
  });
});

export const refresh = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;
  const result = await rotateRefreshToken(refreshToken, req);

  res.status(200).json({
    success: true,
    message: 'Token refreshed successfully.',
    data: result
  });
});

export const logout = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;
  await logoutSession(refreshToken, req);

  res.status(200).json({
    success: true,
    message: 'Logged out successfully.'
  });
});

export const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.validated.forgotPassword;
  const result = await requestPasswordReset(email, req);
  res.status(200).json(result);
});

export const resetPassword = asyncHandler(async (req, res) => {
  const { token, newPassword } = req.validated.resetPassword;
  const result = await resetPasswordService({ token, newPassword }, req);
  res.status(200).json(result);
});

export const getCurrentUser = asyncHandler(async (req, res) => {
  res.status(200).json({
    success: true,
    data: {
      user: {
        id: req.user.id,
        name: req.user.name,
        email: req.user.email,
        role: req.user.role,
        mfaEnabled: req.user.mfaEnabled,
        isVerified: req.user.isVerified
      }
    }
  });
});

export const setupMfa = asyncHandler(async (req, res) => {
  const result = await setupMfaService(req.user.id);
  res.status(200).json({
    success: true,
    data: result
  });
});

export const enableMfa = asyncHandler(async (req, res) => {
  const { code } = req.validated.mfaEnable;
  const result = await enableMfaService(req.user.id, code, req);
  res.status(200).json(result);
});

export const getSessions = asyncHandler(async (req, res) => {
  const sessions = await listUserSessions(req.user.id);
  res.status(200).json({
    success: true,
    data: { sessions }
  });
});

export const revokeSession = asyncHandler(async (req, res) => {
  const { id } = req.params;
  await revokeUserSession(req.user.id, id);
  res.status(200).json({
    success: true,
    message: 'Session revoked successfully.'
  });
});
