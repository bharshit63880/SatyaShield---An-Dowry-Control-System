import { COMPLAINT_RISK_LEVELS, COMPLAINT_STATUSES } from '../models/complaint.model.js';
import { TRIAGE_SEVERITIES } from '../models/triage-assessment.model.js';
import { env } from '../config/env.js';
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
  const privacyAcknowledged = parseBoolean(req.body.privacyAcknowledged);
  const aiConsent = parseBoolean(req.body.aiConsent);
  const complaintCategory = normalizeText(req.body.complaintCategory, 60) || 'unknown';
  const preferredLanguage = normalizeText(req.body.preferredLanguage, 40).toLowerCase() || null;
  const triageAnswer = (field) => {
    const value = normalizeText(req.body[field], 30).toLowerCase() || 'unknown';
    return ['yes', 'no', 'unknown', 'prefer_not_to_say'].includes(value) ? value : null;
  };
  const triageInput = {
    dangerHappeningNow: triageAnswer('dangerHappeningNow'),
    immediateThreatToLife: triageAnswer('immediateThreatToLife'),
    weaponInvolved: triageAnswer('weaponInvolved'),
    seriousInjuryPresent: triageAnswer('seriousInjuryPresent'),
    currentlyConfined: triageAnswer('currentlyConfined'),
    threatEscalating: triageAnswer('threatEscalating'),
    stalkingOrRepeatedContact: triageAnswer('stalkingOrRepeatedContact'),
    vulnerablePersonAtRisk: triageAnswer('vulnerablePersonAtRisk'),
    urgentMedicalHelpNeeded: triageAnswer('urgentMedicalHelpNeeded'),
    canSafelyContinue: triageAnswer('canSafelyContinue'),
    reporterUrgency: normalizeText(req.body.reporterUrgency, 30).toLowerCase() || 'unknown',
    incidentRecency: normalizeText(req.body.incidentRecency, 30).toLowerCase() || 'unknown',
    policyVersion: env.triagePolicyVersion,
    inputSchemaVersion: env.triageInputSchemaVersion
  };

  if (website) {
    return next(new ApiError(400, 'Spam submission blocked.', { code: 'SPAM_DETECTED' }));
  }

  if (
    !privacyAcknowledged ||
    req.body.privacyNoticeVersion !== env.privacyNoticeVersion ||
    req.body.consentVersion !== env.consentVersion
  ) {
    return next(
      new ApiError(400, 'Acknowledge the current privacy notice before submitting.', {
        code: 'PRIVACY_ACKNOWLEDGEMENT_REQUIRED'
      })
    );
  }
  if (!['dowry_harassment', 'domestic_violence', 'legal_support', 'safety_planning'].includes(complaintCategory)) {
    return next(new ApiError(400, 'Select a supported complaint category.', {
      code: 'COMPLAINT_CATEGORY_INVALID'
    }));
  }
  if (Object.values(triageInput).some((value) => value === null) ||
      !['routine', 'concerned', 'urgent', 'unknown', 'prefer_not_to_say'].includes(triageInput.reporterUrgency) ||
      !['happening_now', 'within_24_hours', 'within_week', 'historical', 'unknown', 'prefer_not_to_say']
        .includes(triageInput.incidentRecency)) {
    return next(new ApiError(422, 'One or more safety-question answers are invalid.', {
      code: 'TRIAGE_INPUT_INVALID'
    }));
  }
  if (req.body.severity !== undefined || req.body.riskScore !== undefined) {
    return next(new ApiError(422, 'Severity is determined by the server.', {
      code: 'CLIENT_SEVERITY_NOT_ALLOWED'
    }));
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
      privacyAcknowledged,
      privacyNoticeVersion: env.privacyNoticeVersion,
      consentVersion: env.consentVersion,
      aiConsent,
      aiDisclosureVersion: aiConsent ? env.aiDisclosureVersion : null,
      complaintCategory,
      preferredLanguage
      ,triageInput
    }
  };
  next();
}

export function validateReporterAccessExchange(req, _res, next) {
  const caseId = normalizeText(req.body.caseId, 100);
  const accessSecret = String(req.body.accessSecret ?? '').trim();

  if (
    !/^anon-[0-9a-f-]{36}$/i.test(caseId) ||
    accessSecret.length < 32 ||
    accessSecret.length > 256
  ) {
    return next(
      new ApiError(401, 'Case access credentials are invalid.', {
        code: 'REPORTER_ACCESS_INVALID'
      })
    );
  }

  req.validated = {
    ...req.validated,
    reporterAccess: { caseId, accessSecret }
  };
  next();
}

export function validateDashboardComplaintFilter(req, _res, next) {
  const status = normalizeEnum(req.query.status, COMPLAINT_STATUSES, 'all');
  const riskLevel = normalizeEnum(req.query.riskLevel, TRIAGE_SEVERITIES, 'all');

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

  if (status && ![
    'created', 'pending', 'acknowledged', 'action_in_progress',
    'resolved', 'cancelled', 'superseded'
  ].includes(status)) {
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

  if (password.length < 12 || Buffer.byteLength(password, 'utf8') > 256) {
    return next(new ApiError(400, 'Password must be 12 to 256 bytes long.', { code: 'AUTH_INVALID_PASSWORD_LENGTH' }));
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

  if (newPassword.length < 12 || Buffer.byteLength(newPassword, 'utf8') > 256) {
    return next(new ApiError(400, 'Password must be 12 to 256 bytes long.', { code: 'AUTH_INVALID_PASSWORD_LENGTH' }));
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
