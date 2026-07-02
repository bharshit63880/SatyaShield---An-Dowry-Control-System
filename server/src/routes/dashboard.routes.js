import { Router } from 'express';
import {
  getDashboardSummary,
  getDashboardComplaints,
  updateDashboardComplaintStatus,
  getAuditLogs,
  getEscalations,
  getDetailedAnalytics
} from '../controllers/dashboard.controller.js';
import {
  assignNgo,
  assignInvestigator,
  escalateComplaint,
  resolveEscalation
} from '../controllers/complaint.controller.js';
import {
  validateAuditLogQuery,
  validateDashboardComplaintFilter,
  validateDashboardComplaintStatusRequest,
  validateEscalationQuery
} from '../middlewares/validation.middleware.js';

const router = Router();

// Core Dashboard Info
router.get('/summary', getDashboardSummary);
router.get('/complaints', validateDashboardComplaintFilter, getDashboardComplaints);
router.patch('/complaints/:anonymousId/status', validateDashboardComplaintStatusRequest, updateDashboardComplaintStatus);

// Operator Assign and Escalation Control
router.post('/complaints/:anonymousId/assign-ngo', assignNgo);
router.post('/complaints/:anonymousId/assign-investigator', assignInvestigator);
router.post('/complaints/:anonymousId/escalate', escalateComplaint);
router.patch('/escalations/:id/resolve', resolveEscalation);

// Administrative Analytics & Logs
router.get('/audit-logs', validateAuditLogQuery, getAuditLogs);
router.get('/escalations', validateEscalationQuery, getEscalations);
router.get('/analytics', getDetailedAnalytics);

export default router;
