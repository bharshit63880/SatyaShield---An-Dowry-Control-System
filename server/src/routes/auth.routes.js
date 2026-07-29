import { Router } from 'express';
import {
  disableMfa, enableMfa, forgotPassword, getCurrentUser, getSessions, login, logout, logoutAll,
  logoutOthers, passwordChange, refresh, regenerateRecovery, register,
  resendVerificationController, resetPassword, revokeSession, setupMfa, verifyEmail,
  verifyMfa
} from '../controllers/auth.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { requireCsrf } from '../middlewares/csrf.middleware.js';
import {
  validateForgotPasswordRequest, validateLoginRequest, validateMfaEnableRequest,
  validateRegistrationRequest, validateResetPasswordRequest
} from '../middlewares/validation.middleware.js';
import {
  authLimiter, forgotPasswordLimiter, loginLimiter, mfaLimiter, refreshLimiter,
  resetPasswordLimiter, verificationLimiter
} from '../config/rate-limit.js';

const router = Router();
router.post('/register', authLimiter, validateRegistrationRequest, register);
router.post('/verification/resend', verificationLimiter, resendVerificationController);
router.post('/verify-email', verificationLimiter, verifyEmail);
router.post('/login', loginLimiter, validateLoginRequest, login);
router.post('/login/mfa', mfaLimiter, verifyMfa);
router.post('/refresh', refreshLimiter, requireCsrf, refresh);
router.post('/logout', requireCsrf, logout);
router.post('/forgot-password', forgotPasswordLimiter, validateForgotPasswordRequest, forgotPassword);
router.post('/reset-password', resetPasswordLimiter, validateResetPasswordRequest, resetPassword);
router.get('/me', authenticate, getCurrentUser);
router.post('/password/change', authenticate, passwordChange);
router.post('/mfa/setup', authenticate, setupMfa);
router.post('/mfa/enable', authenticate, validateMfaEnableRequest, enableMfa);
router.post('/mfa/recovery/regenerate', authenticate, regenerateRecovery);
router.post('/mfa/disable', authenticate, disableMfa);
router.get('/sessions', authenticate, getSessions);
router.delete('/sessions/:id', authenticate, revokeSession);
router.post('/sessions/logout-others', authenticate, logoutOthers);
router.post('/sessions/logout-all', authenticate, logoutAll);
export default router;
