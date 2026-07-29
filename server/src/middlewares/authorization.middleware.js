import { asyncHandler } from '../utils/asyncHandler.js';
import {
  authorizeComplaintForStaff,
  authorizationDenied
} from '../services/authorization.service.js';
import { ApiError } from '../utils/ApiError.js';
import { createAuditLog } from '../services/audit.service.js';

export function requireExactRoles(roles) {
  return (req, _res, next) => {
    if (!req.user) {
      return next(new ApiError(401, 'Authentication is required.', { code: 'AUTH_REQUIRED' }));
    }

    if (!roles.includes(req.user.role)) {
      return next(authorizationDenied());
    }

    next();
  };
}

export function authorizeComplaint(action) {
  return asyncHandler(async (req, _res, next) => {
    if (req.reporterCaseAccess) {
      next();
      return;
    }

    let result;
    try {
      result = await authorizeComplaintForStaff({
        user: req.user,
        anonymousId: req.params.anonymousId,
        action
      });
    } catch (error) {
      await createAuditLog({
        userId: req.user?.id,
        role: req.user?.role,
        action: 'authorization_denied',
        resourceType: 'complaint',
        resourceRef: req.params.anonymousId,
        outcome: 'denied',
        errorCode: error.code || 'RESOURCE_ACCESS_DENIED',
        req
      });
      throw error;
    }
    req.staffActor = result.actor;
    req.authorizedComplaint = result.complaint;
    next();
  });
}
