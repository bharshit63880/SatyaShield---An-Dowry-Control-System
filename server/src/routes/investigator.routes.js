import { Router } from 'express';
import {
  registerInvestigator,
  listInvestigators,
  getInvestigatorDashboard,
  addInvestigationNote
} from '../controllers/investigator.controller.js';
import { authenticate, requireAdmin, requireInvestigator } from '../middlewares/auth.middleware.js';

const router = Router();

// Admin-only registration and listing
router.post('/register', authenticate, requireAdmin, registerInvestigator);
router.get('/', authenticate, requireAdmin, listInvestigators);

// Investigator dashboard and case notes
router.get('/dashboard', authenticate, requireInvestigator, getInvestigatorDashboard);
router.post('/complaints/:anonymousId/notes', authenticate, requireInvestigator, addInvestigationNote);

export default router;
