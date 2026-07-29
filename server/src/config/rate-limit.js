import rateLimit from 'express-rate-limit';
import crypto from 'crypto';
import { env } from './env.js';

export function createRateLimiter({ windowMs, limit, code, message, ...options }) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      success: false,
      code,
      message
    },
    ...options
  });
}

export function createAccountActionLimiter({ windowMs, limit, code, action }) {
  return createRateLimiter({
    windowMs, limit, code,
    message: 'Too many attempts. Please wait and try again.',
    keyGenerator(req) {
      const accountHint = String(req.body?.email || req.body?.challengeToken || 'anonymous')
        .trim().toLowerCase();
      return crypto.createHmac('sha256', env.refreshTokenPepper)
        .update(`${action}:${accountHint}`).digest('hex');
    }
  });
}

export const globalApiLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 120,
  code: 'RATE_LIMITED',
  message: 'Too many requests. Please slow down and try again shortly.'
});

export const authLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  code: 'AUTH_RATE_LIMITED',
  message: 'Too many authentication attempts. Please try again later.'
});
export const loginLimiter = createAccountActionLimiter({
  windowMs: 15 * 60 * 1000, limit: 20, code: 'LOGIN_RATE_LIMITED', action: 'login'
});
export const mfaLimiter = createAccountActionLimiter({
  windowMs: 10 * 60 * 1000, limit: 12, code: 'MFA_RATE_LIMITED', action: 'mfa'
});
export const refreshLimiter = createAccountActionLimiter({
  windowMs: 5 * 60 * 1000, limit: 30, code: 'REFRESH_RATE_LIMITED', action: 'refresh'
});
export const forgotPasswordLimiter = createAccountActionLimiter({
  windowMs: 30 * 60 * 1000, limit: 4, code: 'RESET_REQUEST_RATE_LIMITED', action: 'forgot'
});
export const resetPasswordLimiter = createAccountActionLimiter({
  windowMs: 30 * 60 * 1000, limit: 6, code: 'RESET_RATE_LIMITED', action: 'reset'
});
export const verificationLimiter = createAccountActionLimiter({
  windowMs: 30 * 60 * 1000, limit: 5, code: 'VERIFICATION_RATE_LIMITED', action: 'verify'
});

export const complaintSubmissionLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 15,
  code: 'COMPLAINT_RATE_LIMITED',
  message: 'Too many complaint requests from this client. Please try again later.'
});

export const reporterAccessVerificationLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 8,
  code: 'REPORTER_ACCESS_RATE_LIMITED',
  message: 'Too many case access attempts. Please wait before trying again.'
});

export const chatbotLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 25,
  code: 'CHAT_RATE_LIMITED',
  message: 'Too many chat requests right now. Please try again in a few minutes.'
});

export const triageReadLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  code: 'TRIAGE_RATE_LIMITED',
  message: 'Too many triage requests. Please try again later.'
});

export const triageReviewLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  code: 'TRIAGE_REVIEW_RATE_LIMITED',
  message: 'Too many triage review requests. Please try again later.'
});

export const sosCreationLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  code: 'SOS_RATE_LIMITED',
  message: 'Too many safety-request attempts. Please wait briefly and try again.'
});
