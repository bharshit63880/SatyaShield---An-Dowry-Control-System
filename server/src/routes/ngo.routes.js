import { Router } from 'express';
import {
  acknowledgeNgoAssignment,
  registerNgo,
  reviewNgo,
  listNgos,
  getNgoDashboard
} from '../controllers/ngo.controller.js';
import { authenticate, requireAdmin } from '../middlewares/auth.middleware.js';
import { validateNgoListQuery } from '../middlewares/validation.middleware.js';
import { requireExactRoles } from '../middlewares/authorization.middleware.js';
import {
  acknowledge, assignments, getOwnProfile, offerPreview, patchOwnProfile, reject, submitProfile
} from '../controllers/phase6-ngo.controller.js';

const router = Router();

// Public registration
router.post('/register', registerNgo);

// Admin-only directory listing. Review transitions use the Phase 6 dashboard endpoints.
router.get('/', authenticate, requireAdmin, validateNgoListQuery, listNgos);

// NGO dashboard (specific to currently authenticated NGO user)
router.get('/dashboard', authenticate, requireExactRoles(['ngo']), getNgoDashboard);
router.get('/profile/me', authenticate, requireExactRoles(['ngo']), getOwnProfile);
router.patch('/profile/me', authenticate, requireExactRoles(['ngo']), patchOwnProfile);
router.post('/profile/submit', authenticate, requireExactRoles(['ngo']), submitProfile);
router.get('/assignments', authenticate, requireExactRoles(['ngo']), assignments);
router.get('/assignments/:assignmentId', authenticate, requireExactRoles(['ngo']), offerPreview);
router.post('/assignments/:assignmentId/acknowledge', authenticate, requireExactRoles(['ngo']), acknowledge);
router.post('/assignments/:assignmentId/reject', authenticate, requireExactRoles(['ngo']), reject);

export default router;
