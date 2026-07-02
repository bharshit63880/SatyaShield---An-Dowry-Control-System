import { Router } from 'express';

import authRoutes from './auth.routes.js';
import chatbotRoutes from './chatbot.routes.js';
import complaintRoutes from './complaint.routes.js';
import dashboardRoutes from './dashboard.routes.js';
import ngoRoutes from './ngo.routes.js';
import investigatorRoutes from './investigator.routes.js';
import chatRoutes from './chat.routes.js';
import platformRoutes from './platform.routes.js';
import { authenticate, requireStaff } from '../middlewares/auth.middleware.js';

const router = Router();

router.get('/health', (_req, res) => {
  res.status(200).json({
    success: true,
    message: 'Server is healthy.'
  });
});

// Register routers
router.use('/auth', authRoutes);
router.use('/chatbot', chatbotRoutes);
router.use('/complaints', complaintRoutes);
router.use('/ngos', ngoRoutes);
router.use('/investigators', investigatorRoutes);
router.use('/chat', chatRoutes);
router.use('/platform', platformRoutes);

// Protected Staff Dashboard
router.use('/dashboard', authenticate, requireStaff, dashboardRoutes);

export default router;
