import { Router } from 'express';
import {
  registerInvestigator,
  listInvestigators,
  getInvestigatorDashboard,
  addInvestigationNote
} from '../controllers/investigator.controller.js';
import { authenticate, requireAdmin } from '../middlewares/auth.middleware.js';
import { validateInvestigatorListQuery } from '../middlewares/validation.middleware.js';
import {
  authorizeComplaint,
  requireExactRoles
} from '../middlewares/authorization.middleware.js';
import { COMPLAINT_ACTIONS } from '../services/authorization.service.js';

const router = Router();

// Admin-only registration and listing
router.post('/register', authenticate, requireAdmin, registerInvestigator);
router.get('/', authenticate, requireAdmin, validateInvestigatorListQuery, listInvestigators);

// Investigator dashboard and case notes
router.get(
  '/dashboard',
  authenticate,
  requireExactRoles(['investigator']),
  getInvestigatorDashboard
);
router.post(
  '/complaints/:anonymousId/notes',
  authenticate,
  requireExactRoles(['investigator']),
  authorizeComplaint(COMPLAINT_ACTIONS.INVESTIGATION_NOTE_ADD),
  addInvestigationNote
);

export default router;
