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

  req.user = user;
  next();
});

export function requireAdmin(req, _res, next) {
  if (req.user?.role !== 'admin') {
    return next(new ApiError(403, 'Admin access is required.', { code: 'AUTH_ADMIN_REQUIRED' }));
  }

  next();
}
