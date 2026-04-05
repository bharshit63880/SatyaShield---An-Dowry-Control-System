import { Router } from 'express';

import authRoutes from './auth.routes.js';
import chatbotRoutes from './chatbot.routes.js';
import complaintRoutes from './complaint.routes.js';
import dashboardRoutes from './dashboard.routes.js';
import { authenticate, requireAdmin } from '../middlewares/auth.middleware.js';

const router = Router();

router.get('/health', (_req, res) => {
  res.status(200).json({
    success: true,
    message: 'Server is healthy.'
  });
});

router.use('/auth', authRoutes);
router.use('/chatbot', chatbotRoutes);
router.use('/complaints', complaintRoutes);
router.use('/dashboard', authenticate, requireAdmin, dashboardRoutes);

export default router;
