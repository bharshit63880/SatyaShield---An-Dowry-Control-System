import crypto from 'crypto';
import { Notification } from '../models/notification.model.js';

function safeResourceRef(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex').slice(0, 24);
}

export async function sendNotification({
  type,
  title,
  eventClass,
  severity = 'info',
  complaintAnonymousId
}) {
  return Notification.create({
    type,
    title,
    eventClass,
    severity,
    resourceRef: safeResourceRef(complaintAnonymousId),
    deliveryState: 'skipped_not_configured',
    provider: 'none'
  });
}

export function createNewComplaintNotification(complaint) {
  return sendNotification({
    type: 'new-complaint',
    title: 'New case requires review',
    eventClass: 'case-created',
    severity: 'info',
    complaintAnonymousId: complaint.anonymousId
  });
}

export function sendStatusUpdateNotification(complaint) {
  return sendNotification({
    type: 'status-change',
    title: 'Case status changed',
    eventClass: 'case-status-changed',
    complaintAnonymousId: complaint.anonymousId
  });
}

export function listRecentNotifications(limit = 15) {
  return Notification.find().sort({ createdAt: -1 }).limit(limit).lean();
}

export function countUnreadNotifications() {
  return Notification.countDocuments({ isRead: false });
}

export function markNotificationAsRead(id) {
  return Notification.findByIdAndUpdate(id, { isRead: true }, { new: true });
}
