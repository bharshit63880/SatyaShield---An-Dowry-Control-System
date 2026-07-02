import { Router } from 'express';

import {
  register,
  verifyEmail,
  login,
  verifyMfa,
  refresh,
  logout,
  forgotPassword,
  resetPassword,
  getCurrentUser,
  setupMfa,
  enableMfa,
  getSessions,
  revokeSession
} from '../controllers/auth.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import {
  validateLoginRequest,
  validateRegistrationRequest,
  validateForgotPasswordRequest,
  validateResetPasswordRequest,
  validateMfaVerifyRequest,
  validateMfaEnableRequest
} from '../middlewares/validation.middleware.js';
import { authLimiter } from '../config/rate-limit.js';

const router = Router();

// Public auth endpoints
router.post('/register', authLimiter, validateRegistrationRequest, register);
router.post('/login', authLimiter, validateLoginRequest, login);
router.post('/login/mfa', authLimiter, validateMfaVerifyRequest, verifyMfa);
router.post('/refresh-token', refresh);
router.post('/logout', logout);
router.post('/forgot-password', authLimiter, validateForgotPasswordRequest, forgotPassword);
router.post('/reset-password', authLimiter, validateResetPasswordRequest, resetPassword);
router.get('/verify-email', verifyEmail);

// Authenticated auth endpoints
router.get('/me', authenticate, getCurrentUser);
router.post('/mfa/setup', authenticate, setupMfa);
router.post('/mfa/enable', authenticate, validateMfaEnableRequest, enableMfa);
router.get('/sessions', authenticate, getSessions);
router.delete('/sessions/:id', authenticate, revokeSession);

export default router;
