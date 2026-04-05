import { Router } from 'express';
import rateLimit from 'express-rate-limit';

import { createChatbotReply } from '../controllers/chatbot.controller.js';
import { validateChatbotRequest } from '../middlewares/validation.middleware.js';

const router = Router();

const chatbotLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 25,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    code: 'CHAT_RATE_LIMITED',
    message: 'Too many chat requests right now. Please try again in a few minutes.'
  }
});

router.post('/', chatbotLimiter, validateChatbotRequest, createChatbotReply);

export default router;
