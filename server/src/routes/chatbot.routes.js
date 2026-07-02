import { Router } from 'express';

import { createChatbotReply } from '../controllers/chatbot.controller.js';
import { validateChatbotRequest } from '../middlewares/validation.middleware.js';
import { chatbotLimiter } from '../config/rate-limit.js';

const router = Router();

router.post('/', chatbotLimiter, validateChatbotRequest, createChatbotReply);

export default router;
