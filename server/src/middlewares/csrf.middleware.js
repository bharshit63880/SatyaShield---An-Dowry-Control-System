import crypto from 'crypto';
import { env, isProduction } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';

export function readCookie(req, name) {
  const prefix = `${name}=`;
  const item = String(req.headers.cookie || '').split(';')
    .map((value) => value.trim()).find((value) => value.startsWith(prefix));
  return item ? decodeURIComponent(item.slice(prefix.length)) : null;
}

export function requireCsrf(req, _res, next) {
  const origin = req.headers.origin;
  if (origin && !env.clientUrls.includes(origin)) {
    return next(new ApiError(403, 'Request origin is not allowed.', { code: 'CSRF_ORIGIN_DENIED' }));
  }
  const cookie = readCookie(req, env.csrfCookieName);
  const header = req.headers['x-csrf-token'];
  const a = Buffer.from(String(cookie || ''));
  const b = Buffer.from(String(header || ''));
  if (!a.length || a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return next(new ApiError(403, 'CSRF validation failed.', { code: 'CSRF_INVALID' }));
  }
  next();
}

export function authCookieOptions({ httpOnly }) {
  return {
    httpOnly,
    secure: isProduction,
    sameSite: 'strict',
    path: httpOnly ? `/api/${env.apiVersion}/auth` : '/',
    maxAge: env.refreshTokenExpiresDays * 86400000
  };
}
