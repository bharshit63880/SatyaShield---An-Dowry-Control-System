import { AuditLog } from '../models/audit-log.model.js';

export async function createAuditLog({ userId, userEmail, role, action, details = {}, req = null }) {
  let ipAddress = 'unknown';
  let userAgent = 'unknown';

  if (req) {
    ipAddress = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
    userAgent = req.headers['user-agent'] || 'unknown';
  }

  try {
    const log = await AuditLog.create({
      userId,
      userEmail: userEmail || 'anonymous',
      role: role || 'guest',
      action,
      details,
      ipAddress,
      userAgent
    });
    console.log(`[AUDIT LOG] Action: ${action} by User: ${userEmail} (${role})`);
    return log;
  } catch (error) {
    console.error('Failed to write audit log:', error);
  }
}
