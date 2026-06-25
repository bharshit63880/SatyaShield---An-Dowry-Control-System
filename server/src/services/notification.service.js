import { Notification } from '../models/notification.model.js';
import { NotificationPreference } from '../models/notification-preference.model.js';

function getSeverityFromComplaint(complaint) {
  if (complaint.riskLevel === 'high') {
    return 'critical';
  }

  if (complaint.riskLevel === 'medium') {
    return 'warning';
  }

  return 'info';
}

// Main Dispatcher Layer
export async function sendNotification({
  userId = null,
  type,
  title,
  message,
  severity = 'info',
  complaintAnonymousId = null
}) {
  // 1. Create In-App Notification (Database Log)
  const notification = await Notification.create({
    type,
    title,
    message,
    severity,
    complaintAnonymousId
  });

  // 2. Fetch User preferences if userId is provided
  let emailEnabled = true;
  let smsEnabled = false;
  let whatsappEnabled = false;

  if (userId) {
    const preferences = await NotificationPreference.findOne({ userId });
    if (preferences) {
      emailEnabled = preferences.emailEnabled;
      smsEnabled = preferences.smsEnabled;
      whatsappEnabled = preferences.whatsappEnabled;
    }
  }

  // 3. Dispatch out-of-band notifications (Mock logs to Console / DevOps tracer)
  if (emailEnabled) {
    console.log(`[OUT-OF-BAND ALERT] [EMAIL] To: ${userId || 'operators'}, Subject: ${title}, Body: ${message}`);
  }

  if (smsEnabled || severity === 'critical') {
    console.log(`[OUT-OF-BAND ALERT] [SMS] To: Emergency Broadcast, Alert: [${severity.toUpperCase()}] ${title} - ${message}`);
  }

  if (whatsappEnabled || severity === 'critical') {
    console.log(`[OUT-OF-BAND ALERT] [WHATSAPP] Broadcaster: SatyaShield Alert Room, Payload: {"title": "${title}", "msg": "${message}"}`);
  }

  return notification;
}

// Shortcut triggers
export async function createNewComplaintNotification(complaint) {
  const severity = getSeverityFromComplaint(complaint);
  return sendNotification({
    type: 'new-complaint',
    title: 'New Anonymous Complaint Registered',
    message: `Complaint ${complaint.anonymousId} registered with ${complaint.riskLevel} risk. Severity Score: ${complaint.riskScore}.`,
    severity,
    complaintAnonymousId: complaint.anonymousId
  });
}

export async function sendStatusUpdateNotification(complaint, previousStatus, user = null) {
  return sendNotification({
    type: 'new-complaint',
    title: 'Case Status Changed',
    message: `Complaint ${complaint.anonymousId} status changed from ${previousStatus} to ${complaint.status} by ${user?.name || 'system'}.`,
    severity: 'info',
    complaintAnonymousId: complaint.anonymousId
  });
}

export async function listRecentNotifications(limit = 15) {
  return Notification.find()
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
}

export async function countUnreadNotifications() {
  return Notification.countDocuments({ isRead: false });
}

export async function markNotificationAsRead(id) {
  return Notification.findByIdAndUpdate(id, { isRead: true }, { new: true });
}
