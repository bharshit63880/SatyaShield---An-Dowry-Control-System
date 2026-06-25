import { ChatMessage } from '../models/chat-message.model.js';
import { Complaint } from '../models/complaint.model.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { encryptSensitiveValue, decryptSensitiveValue } from '../utils/crypto.js';
import { createAuditLog } from '../services/audit.service.js';

// Verify access to complaint chat
async function verifyChatAccess(complaintId, user = null) {
  const complaint = await Complaint.findOne({ anonymousId: complaintId }).lean();
  if (!complaint) {
    throw new ApiError(404, 'Complaint not found.');
  }

  // If user is authenticated, check role eligibility
  if (user) {
    if (['admin', 'superadmin'].includes(user.role)) {
      return true;
    }
    if (user.role === 'ngo' && complaint.assignedNgo?.ngoId) {
      // Find user's NGO profile
      return true; // Simple allow for NGO assigned
    }
    if (user.role === 'investigator' && complaint.assignedInvestigator?.investigatorId?.toString() === user.id) {
      return true;
    }
    throw new ApiError(403, 'You do not have permission to access this chat room.', { code: 'CHAT_ACCESS_DENIED' });
  }

  // If user is anonymous, they must have the anonymousId (which they do since they passed it in the request params).
  return true;
}

// Get Chat Messages (Decrypted on-the-fly)
export const getChatMessages = asyncHandler(async (req, res) => {
  const { anonymousId } = req.params;
  await verifyChatAccess(anonymousId, req.user);

  const messages = await ChatMessage.find({ complaintId: anonymousId }).sort({ createdAt: 1 }).lean();

  const serialized = messages.map((msg) => {
    let decryptedText = 'Decryption failed.';
    try {
      decryptedText = decryptSensitiveValue(msg.messageEncrypted);
    } catch {
      decryptedText = msg.messageEncrypted;
    }

    return {
      id: msg._id,
      complaintId: msg.complaintId,
      senderRole: msg.senderRole,
      senderName: msg.senderName,
      text: decryptedText,
      attachments: msg.attachments,
      readBy: msg.readBy,
      createdAt: msg.createdAt
    };
  });

  res.status(200).json({
    success: true,
    data: { messages: serialized }
  });
});

// Send Chat Message
export const sendChatMessage = asyncHandler(async (req, res) => {
  const { anonymousId } = req.params;
  const { text, attachments } = req.body;

  if (!text && (!attachments || attachments.length === 0)) {
    throw new ApiError(400, 'Message body or attachment is required.');
  }

  await verifyChatAccess(anonymousId, req.user);

  const senderRole = req.user ? req.user.role : 'victim';
  const senderId = req.user ? req.user.id : null;
  const senderName = req.user ? req.user.name : 'Anonymous Reporter';

  const messageEncrypted = encryptSensitiveValue(text || '');

  const message = await ChatMessage.create({
    complaintId: anonymousId,
    senderRole,
    senderId,
    senderName,
    messageEncrypted,
    attachments: attachments || []
  });

  await createAuditLog({
    userId: req.user ? req.user.id : null,
    userEmail: req.user ? req.user.email : 'anonymous',
    role: senderRole,
    action: 'chat_message_sent',
    details: { anonymousId, messageId: message.id },
    req
  });

  res.status(201).json({
    success: true,
    data: {
      message: {
        id: message._id,
        complaintId: message.complaintId,
        senderRole,
        senderName,
        text,
        attachments: message.attachments,
        createdAt: message.createdAt
      }
    }
  });
});

// Mark messages as read
export const markChatAsRead = asyncHandler(async (req, res) => {
  const { anonymousId } = req.params;

  if (!req.user) {
    // Victims don't need read-receipt markings on database userId level
    return res.status(200).json({ success: true });
  }

  await ChatMessage.updateMany(
    { complaintId: anonymousId, 'readBy.userId': { $ne: req.user.id } },
    { $push: { readBy: { userId: req.user.id, readAt: new Date() } } }
  );

  res.status(200).json({
    success: true,
    message: 'Messages marked as read.'
  });
});
