import { createAuditLog } from '../services/audit.service.js';

const AUDITED_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export function apiAuditLogger(req, res, next) {
  if (!AUDITED_METHODS.has(req.method)) {
    return next();
  }

  res.on('finish', () => {
    if (res.statusCode >= 500) {
      return;
    }

    createAuditLog({
      userId: req.user?.id ?? null,
      userEmail: req.user?.email ?? 'anonymous',
      role: req.user?.role ?? 'guest',
      action: 'api_request',
      details: {
        method: req.method,
        path: req.originalUrl,
        statusCode: res.statusCode,
        requestId: req.requestId
      },
      req
    }).catch(() => {});
  });

  next();
}

