import { sendSuccess } from '../utils/apiResponse.js';

export function apiResponse(_req, res, next) {
  res.success = (options = {}) => sendSuccess(res, options);
  next();
}

