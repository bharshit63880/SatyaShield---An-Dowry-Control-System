import { Router } from 'express';

import { getPlatformConfig, getPublicContent } from '../controllers/platform.controller.js';
import { cacheReady } from '../middlewares/cache.middleware.js';
import { listHelplines } from '../controllers/helpline.controller.js';

const router = Router();

router.get('/config', cacheReady({ maxAgeSeconds: 300 }), getPlatformConfig);
router.get('/content', cacheReady({ maxAgeSeconds: 300 }), getPublicContent);
router.get('/helplines', cacheReady({ maxAgeSeconds: 60 }), listHelplines);

export default router;
