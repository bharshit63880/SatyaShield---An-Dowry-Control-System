import { env } from '../config/env.js';
import { ChatMessage, ChatSequence } from '../models/chat-message.model.js';
import { Evidence } from '../models/evidence.model.js';
import { ApiError } from '../utils/ApiError.js';
import { decryptSensitiveValue, encryptSensitiveValue } from '../utils/crypto.js';
import { safeResourceRef } from './audit.service.js';
import {
  serializeChatMessageForReporter, serializeChatMessageForStaff
} from './reporter-serializer.service.js';

export function normalizeChatText(value) {
  const text = String(value ?? '').normalize('NFC')
    .replace(/\r\n?/g, '\n')
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '')
    .trim();
  if (text.length > env.socketMessageMaxLength) {
    throw new ApiError(422, 'Message is too long.', { code: 'CHAT_MESSAGE_TOO_LONG' });
  }
  return text;
}

export function chatActorFromRequest(req) {
  if (req.reporterCaseAccess) {
    return {
      category: 'reporter',
      ref: safeResourceRef(`reporter:${req.reporterCaseAccess.caseId}`),
      reporter: true
    };
  }
  return {
    category: req.user.role,
    ref: safeResourceRef(`staff:${req.user.id}`),
    reporter: false
  };
}

async function validateAttachments({ complaintId, attachments, reporter }) {
  const values = attachments ?? [];
  if (!Array.isArray(values) || values.length > 5) {
    throw new ApiError(422, 'Chat attachments must reference up to five vault evidence items.', {
      code: 'CHAT_ATTACHMENT_INVALID'
    });
  }
  const evidenceIds = values.map((item) =>
    typeof item === 'string' ? item : item?.evidenceId);
  if (evidenceIds.some((id) => typeof id !== 'string' ||
      !/^[0-9a-f-]{36}$/i.test(id))) {
    throw new ApiError(422, 'Chat attachments must use authorized evidence references.', {
      code: 'CHAT_ATTACHMENT_INVALID'
    });
  }
  if (evidenceIds.length) {
    const count = await Evidence.countDocuments({
      complaintId,
      evidenceId: { $in: [...new Set(evidenceIds)] },
      lifecycleStatus: 'available',
      ...(reporter ? { reporterVisible: true } : {})
    });
    if (count !== new Set(evidenceIds).size) {
      throw new ApiError(403, 'One or more attachments are not authorized for this case.', {
        code: 'CHAT_ATTACHMENT_DENIED'
      });
    }
  }
  return [...new Set(evidenceIds)];
}

function messageView(message, text, actor) {
  return actor.reporter
    ? serializeChatMessageForReporter(message, text)
    : serializeChatMessageForStaff(message, text, actor.category);
}

export async function persistChatMessage({
  complaintId, actor, text, attachments = [], clientMessageId
}) {
  const normalized = normalizeChatText(text);
  const evidenceIds = await validateAttachments({
    complaintId, attachments, reporter: actor.reporter
  });
  if (!normalized && !evidenceIds.length) {
    throw new ApiError(422, 'Message body or attachment is required.', {
      code: 'CHAT_MESSAGE_EMPTY'
    });
  }
  const key = String(clientMessageId || '').trim();
  if (!/^[a-zA-Z0-9_-]{8,100}$/.test(key)) {
    throw new ApiError(422, 'A valid message idempotency key is required.', {
      code: 'CHAT_IDEMPOTENCY_INVALID'
    });
  }
  const existing = await ChatMessage.findOne({
    complaintId, senderRef: actor.ref, clientMessageId: key
  }).select('+messageEncrypted');
  if (existing) {
    return {
      message: existing,
      view: messageView(existing, decryptSensitiveValue(existing.messageEncrypted), actor),
      duplicate: true
    };
  }
  const counter = await ChatSequence.findOneAndUpdate(
    { complaintId },
    { $inc: { nextSequence: 1 } },
    { upsert: true, new: true }
  );
  try {
    const message = await ChatMessage.create({
      complaintId,
      sequence: counter.nextSequence,
      senderActorCategory: actor.category,
      senderRef: actor.ref,
      clientMessageId: key,
      messageType: normalized && evidenceIds.length ? 'text_attachment' :
        evidenceIds.length ? 'attachment' : 'text',
      messageEncrypted: encryptSensitiveValue(normalized),
      attachments: evidenceIds.map((evidenceId) => ({ evidenceId })),
      deliveryState: 'persisted'
    });
    return {
      message,
      view: messageView(message, normalized, actor),
      duplicate: false
    };
  } catch (error) {
    if (error?.code !== 11000) throw error;
    const duplicate = await ChatMessage.findOne({
      complaintId, senderRef: actor.ref, clientMessageId: key
    }).select('+messageEncrypted');
    return {
      message: duplicate,
      view: messageView(duplicate, decryptSensitiveValue(duplicate.messageEncrypted), actor),
      duplicate: true
    };
  }
}

export async function listChatMessages({
  complaintId, actor, afterSequence = 0, limit = env.socketHistoryPageSize
}) {
  const safeLimit = Math.max(1, Math.min(env.socketHistoryPageSize, Number(limit) || 20));
  const messages = await ChatMessage.find({
    complaintId,
    sequence: { $gt: Math.max(0, Number(afterSequence) || 0) },
    tombstonedAt: null
  }).select('+messageEncrypted').sort({ sequence: 1 }).limit(safeLimit).lean();
  return messages.map((message) => {
    let text = '';
    try {
      text = decryptSensitiveValue(message.messageEncrypted);
    } catch {
      text = '[Message unavailable]';
    }
    return messageView(message, text, actor);
  });
}

export async function markMessagesRead({ complaintId, actor, throughSequence, now = new Date() }) {
  const sequence = Math.max(0, Number(throughSequence) || 0);
  await ChatMessage.updateMany({
    complaintId,
    sequence: { $lte: sequence },
    senderRef: { $ne: actor.ref },
    'readBy.actorRef': { $ne: actor.ref }
  }, {
    $push: { readBy: {
      actorRef: actor.ref, actorCategory: actor.category, readAt: now
    } },
    $set: { deliveryState: 'read' }
  });
  return { throughSequence: sequence, state: 'read' };
}
