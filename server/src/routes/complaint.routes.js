import { Router } from 'express';
import rateLimit from 'express-rate-limit';

import { submitComplaint } from '../controllers/complaint.controller.js';
import { uploadComplaintMedia } from '../middlewares/upload.middleware.js';
import { validateComplaintSubmission } from '../middlewares/validation.middleware.js';

const router = Router();

const complaintSubmissionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 8,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    code: 'COMPLAINT_RATE_LIMITED',
    message: 'Too many complaint submissions from this client. Please try again later.'
  }
});

router.post(
  '/',
  complaintSubmissionLimiter,
  uploadComplaintMedia,
  validateComplaintSubmission,
  submitComplaint
);

export default router;
