import rateLimit from 'express-rate-limit';

export function createRateLimiter({ windowMs, limit, code, message }) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      success: false,
      code,
      message
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

export const complaintSubmissionLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 15,
  code: 'COMPLAINT_RATE_LIMITED',
  message: 'Too many complaint requests from this client. Please try again later.'
});

export const chatbotLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 25,
  code: 'CHAT_RATE_LIMITED',
  message: 'Too many chat requests right now. Please try again in a few minutes.'
});

