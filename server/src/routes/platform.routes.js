import { Router } from 'express';

import { getPlatformConfig, getPublicContent } from '../controllers/platform.controller.js';
import { cacheReady } from '../middlewares/cache.middleware.js';

const router = Router();

router.get('/config', cacheReady({ maxAgeSeconds: 300 }), getPlatformConfig);
router.get('/content', cacheReady({ maxAgeSeconds: 300 }), getPublicContent);

export default router;

