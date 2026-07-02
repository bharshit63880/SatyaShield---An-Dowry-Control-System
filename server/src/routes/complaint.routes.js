import { Router } from 'express';

import {
  submitComplaint,
  lookupComplaint,
  getComplaintTimeline,
  uploadComplaintEvidence,
  getEvidenceList
} from '../controllers/complaint.controller.js';
import { uploadComplaintMedia } from '../middlewares/upload.middleware.js';
import { validateComplaintSubmission } from '../middlewares/validation.middleware.js';
import { complaintSubmissionLimiter } from '../config/rate-limit.js';

const router = Router();

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
