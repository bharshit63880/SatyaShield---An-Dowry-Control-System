import crypto from 'crypto';

import { COMPLAINT_STATUSES } from '../models/complaint.model.js';
import { ApiError } from '../utils/ApiError.js';

function normalizeText(value, maxLength) {
  return String(value ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, maxLength);
}

function parseBoolean(value) {
  return value === true || value === 'true' || value === 'on';
}

function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function containsExactGps(value) {
  return /-?\d{1,3}\.\d+\s*,\s*-?\d{1,3}\.\d+/.test(value);
}

function buildComplaintFingerprint({ description, city, district, locationConsent, file }) {
  return crypto
    .createHash('sha256')
    .update(
      JSON.stringify({
        description,
        city,
        district,
        locationConsent,
        mimeType: file?.mimetype ?? 'none',
        fileSize: file?.size ?? 0
      })
    )
    .digest('hex');
}

export function validateLoginRequest(req, _res, next) {
  const email = normalizeText(req.body.email, 254).toLowerCase();
  const password = String(req.body.password ?? '');

  if (!email || !password) {
    return next(
      new ApiError(400, 'Email and password are required.', {
        code: 'AUTH_REQUIRED_FIELDS'
      })
    );
  }

  if (!isEmail(email)) {
    return next(new ApiError(400, 'Enter a valid email address.', { code: 'AUTH_INVALID_EMAIL' }));
  }

  if (password.length < 8 || password.length > 128) {
    return next(
      new ApiError(400, 'Password must be between 8 and 128 characters.', {
        code: 'AUTH_INVALID_PASSWORD_LENGTH'
      })
    );
  }

  req.validated = {
    ...req.validated,
    auth: {
      email,
      password
    }
  };
  next();
}

export function validateComplaintSubmission(req, _res, next) {
  const description = normalizeText(req.body.description, 2000);
  const city = normalizeText(req.body.city, 120);
  const district = normalizeText(req.body.district, 120);
  const website = normalizeText(req.body.website, 255);
  const locationConsent = parseBoolean(req.body.locationConsent);

  if (website) {
    return next(new ApiError(400, 'Spam submission blocked.', { code: 'SPAM_DETECTED' }));
  }

  if (!description && !req.file) {
    return next(
      new ApiError(400, 'Provide a description, an image/video upload, or both.', {
        code: 'COMPLAINT_EMPTY'
      })
    );
  }

  if (containsExactGps(city) || containsExactGps(district)) {
    return next(
      new ApiError(400, 'Share only city or district details. Exact GPS coordinates are not allowed.', {
        code: 'COMPLAINT_EXACT_GPS_BLOCKED'
      })
    );
  }

  if (locationConsent && !city && !district) {
    return next(
      new ApiError(400, 'Add a city or district if you want to share approximate location.', {
        code: 'COMPLAINT_LOCATION_REQUIRED'
      })
    );
  }

  req.validated = {
    ...req.validated,
    complaint: {
      description,
      locationConsent,
      approximateLocation:
        locationConsent && (city || district)
          ? {
              city,
              district
            }
          : null,
      submissionFingerprintHash: buildComplaintFingerprint({
        description,
        city,
        district,
        locationConsent,
        file: req.file
      })
    }
  };
  next();
}

export function validateDashboardComplaintFilter(req, _res, next) {
  const status = normalizeText(req.query.status, 40) || 'all';

  if (status !== 'all' && !COMPLAINT_STATUSES.includes(status)) {
    return next(
      new ApiError(400, 'Invalid complaint status filter.', {
        code: 'COMPLAINT_INVALID_FILTER'
      })
    );
  }

  req.validated = {
    ...req.validated,
    complaintFilter: {
      status
    }
  };
  next();
}

export function validateDashboardComplaintStatusRequest(req, _res, next) {
  const status = normalizeText(req.body.status, 40);

  if (!COMPLAINT_STATUSES.includes(status)) {
    return next(
      new ApiError(400, 'Invalid complaint status.', {
        code: 'COMPLAINT_INVALID_STATUS'
      })
    );
  }

  req.validated = {
    ...req.validated,
    complaintStatusUpdate: {
      status
    }
  };
  next();
}

export function validateChatbotRequest(req, _res, next) {
  if (!Array.isArray(req.body.messages) || req.body.messages.length === 0) {
    return next(new ApiError(400, 'At least one chat message is required.', { code: 'CHAT_EMPTY' }));
  }

  const messages = req.body.messages
    .filter((message) => message && ['user', 'assistant'].includes(message.role))
    .slice(-10)
    .map((message) => ({
      role: message.role,
      content: normalizeText(message.content, 1500)
    }))
    .filter((message) => message.content);

  if (!messages.length) {
    return next(
      new ApiError(400, 'Chat message content cannot be empty.', {
        code: 'CHAT_EMPTY_CONTENT'
      })
    );
  }

  req.validated = {
    ...req.validated,
    chat: {
      messages
    }
  };
  next();
}

