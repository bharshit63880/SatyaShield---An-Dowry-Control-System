import fs from 'fs/promises';

import { env } from '../config/env.js';
import { createComplaint, hasRecentComplaintFingerprint } from '../services/complaint.service.js';
import { sanitizeUploadedMedia } from '../services/media-privacy.service.js';
import { createNewComplaintNotification } from '../services/notification.service.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

function getMediaUrl(req, filename) {
  if (!filename) {
    return null;
  }

  const baseUrl = env.serverPublicUrl || `${req.protocol}://${req.get('host')}`;
  return `${baseUrl}/uploads/${filename}`;
}

function getMediaType(file) {
  if (!file) {
    return 'none';
  }

  return file.mimetype.startsWith('video/') ? 'video' : 'image';
}

export const submitComplaint = asyncHandler(async (req, res) => {
  const { description, locationConsent, approximateLocation, submissionFingerprintHash } =
    req.validated.complaint;

  if (await hasRecentComplaintFingerprint(submissionFingerprintHash)) {
    throw new ApiError(
      429,
      'This complaint looks like a recent duplicate submission. Please wait before sending it again.',
      {
        code: 'COMPLAINT_DUPLICATE_SUBMISSION'
      }
    );
  }

  const sanitizedMedia = await sanitizeUploadedMedia(req.file);

  try {
    const complaint = await createComplaint({
      description,
      mediaUrl: getMediaUrl(req, sanitizedMedia?.filename),
      mediaType: getMediaType(sanitizedMedia ?? req.file),
      locationConsent,
      approximateLocation,
      submissionFingerprintHash
    });

    await createNewComplaintNotification(complaint);

    res.status(201).json({
      success: true,
      message: 'Complaint submitted successfully.',
      data: {
        complaint: {
          anonymousId: complaint.anonymousId,
          mediaUrl: complaint.mediaUrl,
          mediaType: complaint.mediaType,
          description,
          timestamp: complaint.timestamp,
          status: complaint.status,
          locationConsent,
          approximateLocation: locationConsent
            ? [approximateLocation?.city, approximateLocation?.district]
                .filter(Boolean)
                .join(', ') || null
            : null
        }
      }
    });
  } catch (error) {
    if (sanitizedMedia?.path) {
      await fs.rm(sanitizedMedia.path, { force: true }).catch(() => {});
    }

    throw error;
  }
});
