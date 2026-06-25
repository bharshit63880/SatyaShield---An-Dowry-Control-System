import { Router } from 'express';
import rateLimit from 'express-rate-limit';

import {
  submitComplaint,
  lookupComplaint,
  getComplaintTimeline,
  uploadComplaintEvidence,
  getEvidenceList
} from '../controllers/complaint.controller.js';
import { uploadComplaintMedia } from '../middlewares/upload.middleware.js';
import { validateComplaintSubmission } from '../middlewares/validation.middleware.js';

const router = Router();

const complaintSubmissionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    code: 'COMPLAINT_RATE_LIMITED',
    message: 'Too many complaint requests from this client. Please try again later.'
  }
});

// Intake
router.post(
  '/',
  complaintSubmissionLimiter,
  uploadComplaintMedia,
  validateComplaintSubmission,
  submitComplaint
);

// Public lookup/tracking routes
router.get('/lookup/:anonymousId', lookupComplaint);
router.get('/lookup/:anonymousId/timeline', getComplaintTimeline);
router.get('/lookup/:anonymousId/evidence', getEvidenceList);
router.post(
  '/lookup/:anonymousId/evidence',
  complaintSubmissionLimiter,
  uploadComplaintMedia,
  uploadComplaintEvidence
);

export default router;
