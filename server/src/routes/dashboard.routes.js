import { Router } from 'express';

import {
  getDashboardComplaints,
  getDashboardSummary,
  updateDashboardComplaintStatus
} from '../controllers/dashboard.controller.js';
import {
  validateDashboardComplaintFilter,
  validateDashboardComplaintStatusRequest
} from '../middlewares/validation.middleware.js';

const router = Router();

router.get('/summary', getDashboardSummary);
router.get('/complaints', validateDashboardComplaintFilter, getDashboardComplaints);
router.patch(
  '/complaints/:anonymousId/status',
  validateDashboardComplaintStatusRequest,
  updateDashboardComplaintStatus
);

export default router;
