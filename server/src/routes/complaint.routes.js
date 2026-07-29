import { Router } from 'express';

import {
  submitComplaint,
  lookupComplaint,
  getComplaintTimeline,
  uploadComplaintEvidence,
  downloadComplaintEvidence,
  getEvidenceList,
  exchangeReporterAccess
} from '../controllers/complaint.controller.js';
import { createReviewRequest, getTriage } from '../controllers/triage.controller.js';
import { uploadComplaintMedia } from '../middlewares/upload.middleware.js';
import {
  validateComplaintSubmission,
  validateReporterAccessExchange
} from '../middlewares/validation.middleware.js';
import {
  complaintSubmissionLimiter,
  reporterAccessVerificationLimiter,
  sosCreationLimiter,
  triageReadLimiter,
  triageReviewLimiter
} from '../config/rate-limit.js';
import {
  requireReporterCaseAccess, requireReporterOrStaff
} from '../middlewares/reporter-access.middleware.js';
import { authorizeComplaint } from '../middlewares/authorization.middleware.js';
import { COMPLAINT_ACTIONS } from '../services/authorization.service.js';
import {
  activate, cancelConfirmation, getCurrentSos, startConfirmation
} from '../controllers/sos.controller.js';

const router = Router();

// Intake
router.post(
  '/',
  complaintSubmissionLimiter,
  uploadComplaintMedia,
  validateComplaintSubmission,
  submitComplaint
);

router.post(
  '/reporter-access/token',
  reporterAccessVerificationLimiter,
  validateReporterAccessExchange,
  exchangeReporterAccess
);

// Reporter-scoped or authenticated staff case routes
router.post(
  '/lookup/:anonymousId/sos/confirmations',
  sosCreationLimiter,
  requireReporterCaseAccess,
  startConfirmation
);
router.delete(
  '/lookup/:anonymousId/sos/:sosId',
  sosCreationLimiter,
  requireReporterCaseAccess,
  cancelConfirmation
);
router.post(
  '/lookup/:anonymousId/sos/:sosId/activate',
  sosCreationLimiter,
  requireReporterCaseAccess,
  activate
);
router.get(
  '/lookup/:anonymousId/sos',
  requireReporterOrStaff,
  authorizeComplaint(COMPLAINT_ACTIONS.SOS_READ),
  getCurrentSos
);
router.get(
  '/lookup/:anonymousId/triage',
  triageReadLimiter,
  requireReporterOrStaff,
  authorizeComplaint(COMPLAINT_ACTIONS.TRIAGE_READ),
  getTriage
);
router.post(
  '/lookup/:anonymousId/triage/review-request',
  triageReviewLimiter,
  requireReporterOrStaff,
  authorizeComplaint(COMPLAINT_ACTIONS.TRIAGE_REVIEW_REQUEST),
  createReviewRequest
);
router.get(
  '/lookup/:anonymousId',
  requireReporterOrStaff,
  authorizeComplaint(COMPLAINT_ACTIONS.READ),
  lookupComplaint
);
router.get(
  '/lookup/:anonymousId/timeline',
  requireReporterOrStaff,
  authorizeComplaint(COMPLAINT_ACTIONS.TIMELINE_READ),
  getComplaintTimeline
);
router.get(
  '/lookup/:anonymousId/evidence',
  requireReporterOrStaff,
  authorizeComplaint(COMPLAINT_ACTIONS.EVIDENCE_READ),
  getEvidenceList
);
router.post(
  '/lookup/:anonymousId/evidence',
  complaintSubmissionLimiter,
  requireReporterOrStaff,
  authorizeComplaint(COMPLAINT_ACTIONS.EVIDENCE_UPLOAD),
  uploadComplaintMedia,
  uploadComplaintEvidence
);
router.get(
  '/lookup/:anonymousId/evidence/:evidenceId/download',
  requireReporterOrStaff,
  authorizeComplaint(COMPLAINT_ACTIONS.EVIDENCE_DOWNLOAD),
  downloadComplaintEvidence
);

export default router;
