import { authenticate } from './auth.middleware.js';
import { ApiError } from '../utils/ApiError.js';
import jwt from 'jsonwebtoken';
import {
  REPORTER_TOKEN_TYPE,
  verifyReporterCaseToken
} from '../utils/reporter-access.js';

function extractBearerToken(header) {
  if (!header?.startsWith('Bearer ')) {
    return null;
  }

  return header.slice(7).trim() || null;
}

function reporterAuthenticationError(code = 'REPORTER_ACCESS_REQUIRED') {
  return new ApiError(401, 'Reporter case access is required or has expired.', { code });
}

export function requireReporterCaseAccess(req, _res, next) {
  const token = extractBearerToken(req.headers.authorization);
  if (!token) {
    return next(reporterAuthenticationError());
  }

  try {
    const payload = verifyReporterCaseToken(token);
    const requestedCaseId = req.params.anonymousId ?? req.params.caseId;

    if (requestedCaseId && payload.caseId !== requestedCaseId) {
      return next(
        new ApiError(403, 'This reporter token does not grant access to the requested case.', {
          code: 'REPORTER_CASE_SCOPE_DENIED'
        })
      );
    }

    req.reporterCaseAccess = {
      caseId: payload.caseId,
      expiresAt: payload.exp ? new Date(payload.exp * 1000) : null,
      tokenId: payload.jti
    };
    return next();
  } catch (error) {
    const code = error?.name === 'TokenExpiredError'
      ? 'REPORTER_ACCESS_EXPIRED'
      : 'REPORTER_ACCESS_INVALID';
    return next(reporterAuthenticationError(code));
  }
}

export function requireReporterOrStaff(req, res, next) {
  const token = extractBearerToken(req.headers.authorization);
  if (!token) {
    return next(reporterAuthenticationError());
  }

  try {
    const payload = verifyReporterCaseToken(token);
    const requestedCaseId = req.params.anonymousId ?? req.params.caseId;

    if (requestedCaseId && payload.caseId !== requestedCaseId) {
      return next(
        new ApiError(403, 'This reporter token does not grant access to the requested case.', {
          code: 'REPORTER_CASE_SCOPE_DENIED'
        })
      );
    }

    req.reporterCaseAccess = {
      caseId: payload.caseId,
      expiresAt: payload.exp ? new Date(payload.exp * 1000) : null,
      tokenId: payload.jti
    };
    return next();
  } catch (error) {
    const unverifiedPayload = jwt.decode(token);
    if (unverifiedPayload?.tokenType === REPORTER_TOKEN_TYPE) {
      const code = error?.name === 'TokenExpiredError'
        ? 'REPORTER_ACCESS_EXPIRED'
        : 'REPORTER_ACCESS_INVALID';
      return next(reporterAuthenticationError(code));
    }

    return authenticate(req, res, (authenticationError) => {
      if (authenticationError) {
        return next(reporterAuthenticationError('CASE_ACCESS_INVALID'));
      }

      return next();
    });
  }
}
