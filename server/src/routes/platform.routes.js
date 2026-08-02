import { Router } from 'express';

import { getPlatformConfig, getPublicContent } from '../controllers/platform.controller.js';
import { cacheReady } from '../middlewares/cache.middleware.js';
import { listHelplines } from '../controllers/helpline.controller.js';
import {
  createLegalContentEntry,
  listPublicLegalContent,
  transitionLegalContentEntry
} from '../controllers/legal-content.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { requireCsrf } from '../middlewares/csrf.middleware.js';
import { requireExactRoles } from '../middlewares/authorization.middleware.js';

const router = Router();

router.get('/config', cacheReady({ maxAgeSeconds: 300 }), getPlatformConfig);
router.get('/content', cacheReady({ maxAgeSeconds: 300 }), getPublicContent);
router.get('/helplines', cacheReady({ maxAgeSeconds: 60 }), listHelplines);
router.get('/legal-content', cacheReady({ maxAgeSeconds: 300 }), listPublicLegalContent);
router.post('/legal-content', authenticate, requireCsrf, requireExactRoles(['superadmin']), createLegalContentEntry);
router.patch('/legal-content/:id', authenticate, requireCsrf, requireExactRoles(['superadmin']), transitionLegalContentEntry);

export default router;
