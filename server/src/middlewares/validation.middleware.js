import crypto from 'crypto';

import { COMPLAINT_RISK_LEVELS, COMPLAINT_STATUSES } from '../models/complaint.model.js';
import { ApiError } from '../utils/ApiError.js';
import { parsePagination, parseSearch, parseSort } from '../utils/query.js';

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

function normalizeEnum(value, allowedValues, fallback = 'all') {
  const normalized = normalizeText(value, 60) || fallback;
  if (normalized !== 'all' && !allowedValues.includes(normalized)) {
    return null;
  }

  return normalized;
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
  const status = normalizeEnum(req.query.status, COMPLAINT_STATUSES, 'all');
  const riskLevel = normalizeEnum(req.query.riskLevel, COMPLAINT_RISK_LEVELS, 'all');

  if (!status) {
    return next(
      new ApiError(400, 'Invalid complaint status filter.', {
        code: 'COMPLAINT_INVALID_FILTER'
      })
    );
  }

  if (!riskLevel) {
    return next(
      new ApiError(400, 'Invalid complaint risk filter.', {
        code: 'COMPLAINT_INVALID_RISK_FILTER'
      })
    );
  }

  let sort;
  try {
    sort = parseSort(
      req.query,
      {
        timestamp: 'timestamp',
        createdAt: 'createdAt',
        status: 'status',
        riskLevel: 'riskLevel',
        riskScore: 'riskScore'
      },
      '-timestamp'
    );
  } catch (error) {
    return next(error);
  }

  const { page, limit, skip } = parsePagination(req.query);

  req.validated = {
    ...req.validated,
    complaintFilter: {
      status,
      riskLevel,
      assignedNgoId: normalizeText(req.query.assignedNgoId, 120),
      assignedInvestigatorId: normalizeText(req.query.assignedInvestigatorId, 120),
      search: parseSearch(req.query),
      page,
      limit,
      skip,
      sort
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

export function validateAuditLogQuery(req, _res, next) {
  let sort;
  try {
    sort = parseSort(
      req.query,
      {
        createdAt: 'createdAt',
        action: 'action',
        userEmail: 'userEmail',
        role: 'role'
      },
      '-createdAt'
    );
  } catch (error) {
    return next(error);
  }

  const { page, limit, skip } = parsePagination(req.query);

  req.validated = {
    ...req.validated,
    auditLogQuery: {
      page,
      limit,
      skip,
      search: parseSearch(req.query),
      action: normalizeText(req.query.action, 80),
      role: normalizeText(req.query.role, 40),
      sort
    }
  };
  next();
}

export function validateEscalationQuery(req, _res, next) {
  let sort;
  try {
    sort = parseSort(
      req.query,
      {
        createdAt: 'createdAt',
        status: 'status',
        complaintId: 'complaintId'
      },
      '-createdAt'
    );
  } catch (error) {
    return next(error);
  }

  const { page, limit, skip } = parsePagination(req.query);
  const status = normalizeText(req.query.status, 40);

  if (status && !['pending', 'resolved'].includes(status)) {
    return next(new ApiError(400, 'Invalid escalation status filter.', { code: 'ESCALATION_INVALID_STATUS' }));
  }

  req.validated = {
    ...req.validated,
    escalationQuery: {
      page,
      limit,
      skip,
      status,
      search: parseSearch(req.query),
      sort
    }
  };
  next();
}

export function validateNgoListQuery(req, _res, next) {
  let sort;
  try {
    sort = parseSort(
      req.query,
      {
        createdAt: 'createdAt',
        name: 'name',
        city: 'city',
        district: 'district',
        status: 'status'
      },
      '-createdAt'
    );
  } catch (error) {
    return next(error);
  }

  const status = normalizeText(req.query.status, 40);
  if (status && !['pending', 'approved', 'rejected'].includes(status)) {
    return next(new ApiError(400, 'Invalid NGO status filter.', { code: 'NGO_INVALID_STATUS' }));
  }

  const { page, limit, skip } = parsePagination(req.query);

  req.validated = {
    ...req.validated,
    ngoListQuery: {
      page,
      limit,
      skip,
      status,
      city: normalizeText(req.query.city, 120),
      district: normalizeText(req.query.district, 120),
      search: parseSearch(req.query),
      sort
    }
  };
  next();
}

export function validateInvestigatorListQuery(req, _res, next) {
  let sort;
  try {
    sort = parseSort(
      req.query,
      {
        createdAt: 'createdAt',
        name: 'name',
        agency: 'agency',
        badgeNumber: 'badgeNumber',
        activeCasesCount: 'activeCasesCount'
      },
      'name'
    );
  } catch (error) {
    return next(error);
  }

  const { page, limit, skip } = parsePagination(req.query);

  req.validated = {
    ...req.validated,
    investigatorListQuery: {
      page,
      limit,
      skip,
      agency: normalizeText(req.query.agency, 120),
      search: parseSearch(req.query),
      sort
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

export function validateRegistrationRequest(req, _res, next) {
  const name = normalizeText(req.body.name, 100);
  const email = normalizeText(req.body.email, 254).toLowerCase();
  const password = String(req.body.password ?? '');
  const role = normalizeText(req.body.role, 40) || 'user';

  if (!email || !password || !name) {
    return next(new ApiError(400, 'Name, email, and password are required.', { code: 'AUTH_REQUIRED_FIELDS' }));
  }

  if (!isEmail(email)) {
    return next(new ApiError(400, 'Enter a valid email address.', { code: 'AUTH_INVALID_EMAIL' }));
  }

  if (password.length < 8) {
    return next(new ApiError(400, 'Password must be at least 8 characters long.', { code: 'AUTH_INVALID_PASSWORD_LENGTH' }));
  }

  const allowedRoles = ['user'];
  if (!allowedRoles.includes(role)) {
    return next(new ApiError(400, 'Invalid registration role.', { code: 'AUTH_INVALID_ROLE' }));
  }

  req.validated = {
    ...req.validated,
    registration: { name, email, password, role }
  };
  next();
}

export function validateForgotPasswordRequest(req, _res, next) {
  const email = normalizeText(req.body.email, 254).toLowerCase();
  if (!email || !isEmail(email)) {
    return next(new ApiError(400, 'Enter a valid email address.', { code: 'AUTH_INVALID_EMAIL' }));
  }

  req.validated = {
    ...req.validated,
    forgotPassword: { email }
  };
  next();
}

export function validateResetPasswordRequest(req, _res, next) {
  const token = String(req.body.token ?? '').trim();
  const newPassword = String(req.body.newPassword ?? '');

  if (!token || !newPassword) {
    return next(new ApiError(400, 'Token and new password are required.', { code: 'AUTH_REQUIRED_FIELDS' }));
  }

  if (newPassword.length < 8) {
    return next(new ApiError(400, 'Password must be at least 8 characters long.', { code: 'AUTH_INVALID_PASSWORD_LENGTH' }));
  }

  req.validated = {
    ...req.validated,
    resetPassword: { token, newPassword }
  };
  next();
}

export function validateMfaVerifyRequest(req, _res, next) {
  const userId = String(req.body.userId ?? '').trim();
  const mfaToken = String(req.body.mfaToken ?? '').trim();
  const code = String(req.body.code ?? '').trim();

  if (!userId || !mfaToken || !code) {
    return next(new ApiError(400, 'User ID, MFA token, and code are required.', { code: 'AUTH_REQUIRED_FIELDS' }));
  }

  req.validated = {
    ...req.validated,
    mfaVerify: { userId, mfaToken, code }
  };
  next();
}

export function validateMfaEnableRequest(req, _res, next) {
  const code = String(req.body.code ?? '').trim();
  if (!code) {
    return next(new ApiError(400, 'Code is required.', { code: 'AUTH_REQUIRED_FIELDS' }));
  }

  req.validated = {
    ...req.validated,
    mfaEnable: { code }
  };
  next();
}
