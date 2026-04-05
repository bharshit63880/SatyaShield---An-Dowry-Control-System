import { Router } from 'express';
import rateLimit from 'express-rate-limit';

import { getCurrentUser, login } from '../controllers/auth.controller.js';
import { authenticate, requireAdmin } from '../middlewares/auth.middleware.js';
import { validateLoginRequest } from '../middlewares/validation.middleware.js';

const router = Router();
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 8,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    code: 'AUTH_RATE_LIMITED',
    message: 'Too many login attempts. Please try again later.'
  }
});

router.post('/login', authLimiter, validateLoginRequest, login);
router.get('/me', authenticate, requireAdmin, getCurrentUser);

export default router;
