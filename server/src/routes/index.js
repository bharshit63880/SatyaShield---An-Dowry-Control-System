import { Router } from 'express';

import authRoutes from './auth.routes.js';
import chatbotRoutes from './chatbot.routes.js';
import complaintRoutes from './complaint.routes.js';
import dashboardRoutes from './dashboard.routes.js';
import ngoRoutes from './ngo.routes.js';
import investigatorRoutes from './investigator.routes.js';
import chatRoutes from './chat.routes.js';
import platformRoutes from './platform.routes.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { getReadinessSnapshot } from '../services/readiness.service.js';

const router = Router();

router.get('/health', (_req, res) => {
  res.status(200).json({
    success: true,
    message: 'Server is healthy.'
  });
});

router.get('/live', (_req, res) => {
  res.status(200).json({ success: true, message: 'Service is live.' });
});

router.get('/ready', (_req, res) => {
  const readiness = getReadinessSnapshot();
  res.status(readiness.ready ? 200 : 503).json({
    success: readiness.ready,
    message: readiness.ready ? 'Service is ready.' : 'Service is not ready.',
    data: { checks: readiness.checks }
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
router.use('/dashboard', authenticate, dashboardRoutes);

export default router;
