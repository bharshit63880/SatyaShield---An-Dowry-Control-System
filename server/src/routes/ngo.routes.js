import { Router } from 'express';
import { registerNgo, reviewNgo, listNgos, getNgoDashboard } from '../controllers/ngo.controller.js';
import { authenticate, requireAdmin, requireNGO } from '../middlewares/auth.middleware.js';

const router = Router();

// Public registration
router.post('/register', registerNgo);

// Admin-only review/approvals
router.get('/', authenticate, requireAdmin, listNgos);
router.patch('/:id/review', authenticate, requireAdmin, reviewNgo);

// NGO dashboard (specific to currently authenticated NGO user)
router.get('/dashboard', authenticate, requireNGO, getNgoDashboard);

export default router;
