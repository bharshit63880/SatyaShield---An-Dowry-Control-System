import crypto from 'crypto';

import { ChatMessage } from '../models/chat-message.model.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendCreated, sendSuccess } from '../utils/apiResponse.js';
import { createAuditLog } from '../services/audit.service.js';
import {
  chatActorFromRequest, listChatMessages, markMessagesRead, persistChatMessage
} from '../services/chat.service.js';

export const getChatMessages = asyncHandler(async (req, res) => {
  const actor = chatActorFromRequest(req);
  const messages = await listChatMessages({
    complaintId: req.params.anonymousId,
    actor,
    afterSequence: req.query.after,
    limit: req.query.limit
  });
  return sendSuccess(res, {
    message: 'Chat messages fetched successfully.',
    data: {
      messages,
      nextCursor: messages.at(-1)?.sequence ?? (Number(req.query.after) || 0)
    }
  });
});

export const sendChatMessage = asyncHandler(async (req, res) => {
  const actor = chatActorFromRequest(req);
  const result = await persistChatMessage({
    complaintId: req.params.anonymousId,
    actor,
    text: req.body.text,
    attachments: req.body.attachments,
    clientMessageId: req.body.clientMessageId ||
      req.headers['x-idempotency-key'] || `rest-${crypto.randomUUID()}`
  });
  await createAuditLog({
    userId: req.user?.id,
    role: actor.category,
    action: 'chat_message_sent',
    resourceType: 'complaint',
    resourceRef: req.params.anonymousId,
    details: {
      category: result.duplicate ? 'idempotent_replay' : 'persisted',
      contentLength: String(req.body.text || '').length
    },
    req
  });
  return sendCreated(res, {
    message: result.duplicate ? 'Existing chat message returned.' : 'Chat message persisted.',
    data: { message: result.view, duplicate: result.duplicate }
  });
});

export const markChatAsRead = asyncHandler(async (req, res) => {
  const actor = chatActorFromRequest(req);
  const throughSequence = req.body.throughSequence ??
    (await ChatMessage.findOne({ complaintId: req.params.anonymousId })
      .sort({ sequence: -1 }).select('sequence').lean())?.sequence ?? 0;
  const receipt = await markMessagesRead({
    complaintId: req.params.anonymousId, actor, throughSequence
  });
  return sendSuccess(res, {
    message: 'Messages marked as read.',
    data: { receipt }
  });
});
