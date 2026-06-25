import { User } from '../models/user.model.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { verifyAccessToken } from '../utils/jwt.js';

function extractBearerToken(authorizationHeader) {
  if (!authorizationHeader?.startsWith('Bearer ')) {
    throw new ApiError(401, 'Authentication token is missing.', {
      code: 'AUTH_TOKEN_MISSING'
    });
  }

  const token = authorizationHeader.slice(7).trim();

  if (!token) {
    throw new ApiError(401, 'Authentication token is missing.', {
      code: 'AUTH_TOKEN_MISSING'
    });
  }

  return token;
}

export const authenticate = asyncHandler(async (req, _res, next) => {
  const token = extractBearerToken(req.headers.authorization);

  let decodedToken;
  try {
    decodedToken = verifyAccessToken(token);
  } catch {
    throw new ApiError(401, 'Authentication token is invalid or expired.', {
      code: 'AUTH_TOKEN_INVALID'
    });
  }

  const user = await User.findById(decodedToken.sub).select('-passwordHash');

  if (!user) {
    throw new ApiError(401, 'Account not found.', {
      code: 'AUTH_ACCOUNT_NOT_FOUND'
    });
  }

  if (user.accountLocked) {
    throw new ApiError(423, 'Account is locked.', { code: 'AUTH_ACCOUNT_LOCKED' });
  }

  req.user = user;
  next();
});

// Checks if the user role is within a list of allowed roles
export function requireRoles(roles = []) {
  return (req, _res, next) => {
    if (!req.user) {
      return next(new ApiError(401, 'Authentication is required.', { code: 'AUTH_REQUIRED' }));
    }

    if (!roles.includes(req.user.role)) {
      return next(
        new ApiError(403, `Access denied. Role policy violation. Requires one of: ${roles.join(', ')}`, {
          code: 'AUTH_ROLE_DENIED'
        })
      );
    }

    next();
  };
}

// Shortcut checks
export const requireAdmin = requireRoles(['admin', 'superadmin']);
export const requireSuperAdmin = requireRoles(['superadmin']);
export const requireNGO = requireRoles(['ngo', 'admin', 'superadmin']);
export const requireInvestigator = requireRoles(['investigator', 'admin', 'superadmin']);
export const requireStaff = requireRoles(['ngo', 'investigator', 'admin', 'superadmin']);
