import { Router } from 'express';
import { getChatMessages, sendChatMessage, markChatAsRead } from '../controllers/chat.controller.js';
import { requireReporterOrStaff } from '../middlewares/reporter-access.middleware.js';
import { authorizeComplaint } from '../middlewares/authorization.middleware.js';
import { COMPLAINT_ACTIONS } from '../services/authorization.service.js';

const router = Router();

router.get(
  '/:anonymousId',
  requireReporterOrStaff,
  authorizeComplaint(COMPLAINT_ACTIONS.CHAT_READ),
  getChatMessages
);
router.post(
  '/:anonymousId',
  requireReporterOrStaff,
  authorizeComplaint(COMPLAINT_ACTIONS.CHAT_SEND),
  sendChatMessage
);
router.post(
  '/:anonymousId/read',
  requireReporterOrStaff,
  authorizeComplaint(COMPLAINT_ACTIONS.CHAT_MARK_READ),
  markChatAsRead
);

export default router;
