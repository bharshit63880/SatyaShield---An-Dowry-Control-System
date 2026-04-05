import { Notification } from '../models/notification.model.js';

function getSeverityFromComplaint(complaint) {
  if (complaint.riskLevel === 'high') {
    return 'critical';
  }

  if (complaint.riskLevel === 'medium') {
    return 'warning';
  }

  return 'info';
}

export async function createNewComplaintNotification(complaint) {
  return Notification.create({
    type: 'new-complaint',
    title: 'New complaint received',
    message: `Complaint ${complaint.anonymousId} submitted with ${complaint.riskLevel} risk.`,
    severity: getSeverityFromComplaint(complaint),
    complaintAnonymousId: complaint.anonymousId
  });
}

export async function listRecentNotifications(limit = 10) {
  return Notification.find()
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
}

export async function countUnreadNotifications() {
  return Notification.countDocuments({ isRead: false });
}

