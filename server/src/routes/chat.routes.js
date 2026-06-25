import { Router } from 'express';
import { getChatMessages, sendChatMessage, markChatAsRead } from '../controllers/chat.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';

const router = Router();

// Endpoint access supports both:
// 1) Authenticated operators (through Bearer token header)
// 2) Anonymous reporters (without token)
// Thus authenticate middleware is optional for lookup, handled dynamically inside controller.
function optionalAuthenticate(req, res, next) {
  if (req.headers.authorization) {
    return authenticate(req, res, next);
  }
  next();
}

router.get('/:anonymousId', optionalAuthenticate, getChatMessages);
router.post('/:anonymousId', optionalAuthenticate, sendChatMessage);
router.post('/:anonymousId/read', optionalAuthenticate, markChatAsRead);

export default router;
