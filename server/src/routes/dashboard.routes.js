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
import {
  authorizeComplaint,
  requireExactRoles
} from '../middlewares/authorization.middleware.js';
import { COMPLAINT_ACTIONS } from '../services/authorization.service.js';
import {
  createOffer, reassignOffer, reviewAction, reviewDetail, reviewQueue, routingCandidates, withdrawOffer
} from '../controllers/phase6-admin.controller.js';
import {
  performTriageReview, triageHistory, triageQueue
} from '../controllers/triage.controller.js';
import { triageReadLimiter, triageReviewLimiter } from '../config/rate-limit.js';
import {
  deadlineQueue, escalationAction, escalationQueue, runScheduler
} from '../controllers/escalation-workflow.controller.js';
import {
  getLocation, sosQueue, staffAction
} from '../controllers/sos.controller.js';
import {
  createDraft as createHelplineDraft,
  reviewEntry as reviewHelplineEntry
} from '../controllers/helpline.controller.js';

const router = Router();
router.use(requireExactRoles(['admin', 'superadmin']));

// Core Dashboard Info
router.get('/summary', getDashboardSummary);
router.get('/complaints', validateDashboardComplaintFilter, getDashboardComplaints);
router.patch(
  '/complaints/:anonymousId/status',
  authorizeComplaint(COMPLAINT_ACTIONS.STATUS_UPDATE),
  validateDashboardComplaintStatusRequest,
  updateDashboardComplaintStatus
);

// Operator Assign and Escalation Control
router.post(
  '/complaints/:anonymousId/assign-investigator',
  authorizeComplaint(COMPLAINT_ACTIONS.INVESTIGATOR_ASSIGN),
  assignInvestigator
);
router.post(
  '/complaints/:anonymousId/escalate',
  authorizeComplaint(COMPLAINT_ACTIONS.ESCALATE),
  escalateComplaint
);
router.patch('/escalations/:id/resolve', resolveEscalation);

// Administrative Analytics & Logs
router.get('/audit-logs', validateAuditLogQuery, getAuditLogs);
router.get('/escalations', validateEscalationQuery, getEscalations);
router.get('/analytics', getDetailedAnalytics);
router.get('/ngos/review-queue', reviewQueue);
router.get('/ngos/:publicId', reviewDetail);
router.post('/ngos/:publicId/review/:action', reviewAction);
router.get('/complaints/:anonymousId/ngo-candidates', routingCandidates);
router.post('/complaints/:anonymousId/ngo-offers', createOffer);
router.delete('/complaints/:anonymousId/ngo-offers/:assignmentId', withdrawOffer);
router.post('/complaints/:anonymousId/ngo-offers/:assignmentId/reassign', reassignOffer);
router.get('/triage/queue', triageReadLimiter, triageQueue);
router.get('/complaints/:anonymousId/triage', triageReadLimiter, triageHistory);
router.post('/complaints/:anonymousId/triage/review', triageReviewLimiter, performTriageReview);
router.get('/workflow/deadlines', triageReadLimiter, deadlineQueue);
router.get('/workflow/escalations', triageReadLimiter, escalationQueue);
router.post('/workflow/escalations/:escalationId/actions', triageReviewLimiter, escalationAction);
router.post('/workflow/scheduler/run', triageReviewLimiter, runScheduler);
router.get('/sos', triageReadLimiter, sosQueue);
router.post('/complaints/:anonymousId/sos/:sosId/actions', triageReviewLimiter, staffAction);
router.get('/complaints/:anonymousId/sos/:sosId/location', triageReadLimiter, getLocation);
router.post('/helplines', triageReviewLimiter, createHelplineDraft);
router.post('/helplines/:helplineId/review', triageReviewLimiter, reviewHelplineEntry);

export default router;
