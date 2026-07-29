import crypto from 'crypto';
import { Server } from 'socket.io';

import { env } from '../config/env.js';
import { ChatMessage } from '../models/chat-message.model.js';
import { User } from '../models/user.model.js';
import { authorizeComplaintForStaff, COMPLAINT_ACTIONS } from './authorization.service.js';
import { createAuditLog, safeResourceRef } from './audit.service.js';
import {
  listChatMessages, markMessagesRead, persistChatMessage
} from './chat.service.js';
import { logEvent } from './logger.service.js';
import {
  registerRealtimePublishHandler, registerRealtimeRevocationHandler
} from './realtime-revocation.service.js';
import { verifyAccessToken } from '../utils/jwt.js';
import { verifyReporterCaseToken } from '../utils/reporter-access.js';

const roomKey = (caseId) => `case:${crypto.createHmac(
  'sha256', env.reporterAccessHmacKey
).update(`socket-room:${caseId}`).digest('hex')}`;

const publicError = (code, message) => ({ ok: false, code, message });
const acknowledge = (callback, value) => {
  if (typeof callback === 'function') callback(value);
};

function limiter(socket, action, limit, windowMs = 60_000) {
  const now = Date.now();
  const existing = socket.data.limits.get(action) || [];
  const active = existing.filter((value) => now - value < windowMs);
  if (active.length >= limit) return false;
  active.push(now);
  socket.data.limits.set(action, active);
  return true;
}

async function authenticateHandshake(socket) {
  if (Object.keys(socket.handshake.query || {}).some((key) =>
    /token|credential|authorization|secret/i.test(key))) {
    throw new Error('SOCKET_QUERY_CREDENTIAL_REJECTED');
  }
  const credentialType = socket.handshake.auth?.credentialType;
  const token = socket.handshake.auth?.token;
  if (!['reporter', 'staff'].includes(credentialType) || typeof token !== 'string') {
    throw new Error('SOCKET_AUTH_INVALID');
  }
  if (credentialType === 'reporter') {
    const payload = verifyReporterCaseToken(token);
    return {
      type: 'reporter', category: 'reporter',
      caseId: payload.caseId,
      ref: safeResourceRef(`reporter:${payload.caseId}`),
      expiresAt: payload.exp * 1000
    };
  }
  const payload = verifyAccessToken(token);
  const user = await User.findById(payload.sub).select('-passwordHash').lean();
  if (!user || user.accountState !== 'active' || !user.isVerified ||
      user.accountLocked || user.role !== payload.role || user.authVersion !== payload.ver) {
    throw new Error('SOCKET_AUTH_INVALID');
  }
  return {
    type: 'staff', category: user.role, userId: String(user._id),
    ref: safeResourceRef(`staff:${user._id}`),
    authVersion: user.authVersion,
    expiresAt: payload.exp * 1000
  };
}

async function authorizeCase(socket, caseId, action) {
  const actor = socket.data.actor;
  if (Date.now() >= actor.expiresAt) throw new Error('SOCKET_SESSION_EXPIRED');
  if (actor.type === 'reporter') {
    if (actor.caseId !== caseId) throw new Error('RESOURCE_ACCESS_DENIED');
    return actor;
  }
  const user = await User.findById(actor.userId).select('-passwordHash');
  if (!user || user.accountState !== 'active' || user.accountLocked ||
      !user.isVerified || user.authVersion !== actor.authVersion) {
    throw new Error('SOCKET_SESSION_EXPIRED');
  }
  const result = await authorizeComplaintForStaff({
    user, anonymousId: caseId, action
  });
  return { ...actor, staffActor: result.actor };
}

export function createSocketChatServer(httpServer) {
  if (!env.socketIoEnabled) return null;
  const io = new Server(httpServer, {
    cors: { origin: env.clientUrls, credentials: true },
    transports: ['websocket', 'polling'],
    allowRequest(req, callback) {
      callback(null, !/[?&](token|access_token|reporterToken|secret)=/i.test(req.url || ''));
    }
  });

  io.use(async (socket, next) => {
    try {
      socket.data.actor = await authenticateHandshake(socket);
      socket.data.subscriptions = new Set();
      socket.data.limits = new Map();
      logEvent('info', 'socket_authenticated', {
        actorCategory: socket.data.actor.category
      });
      next();
    } catch {
      logEvent('warn', 'socket_auth_failed', { outcome: 'denied' });
      next(new Error('SOCKET_AUTH_INVALID'));
    }
  });

  io.on('connection', (socket) => {
    socket.on('case:join', async (payload = {}, callback) => {
      if (!limiter(socket, 'join', 15)) {
        acknowledge(callback, publicError('SOCKET_RATE_LIMITED', 'Too many room requests.'));
        return;
      }
      const caseId = String(payload.caseId || '');
      try {
        await authorizeCase(socket, caseId, COMPLAINT_ACTIONS.CHAT_READ);
        const room = roomKey(caseId);
        await socket.join(room);
        socket.data.subscriptions.add(caseId);
        await createAuditLog({
          role: socket.data.actor.category, action: 'room_join_allowed',
          resourceType: 'complaint', resourceRef: caseId,
          details: { category: 'complaint_chat' }
        });
        acknowledge(callback, { ok: true, state: 'joined' });
        socket.to(room).emit('presence:changed', {
          caseRef: safeResourceRef(caseId), state: 'available'
        });
      } catch {
        logEvent('warn', 'room_join_denied', {
          actorCategory: socket.data.actor.category
        });
        acknowledge(callback, publicError(
          'RESOURCE_ACCESS_DENIED', 'This chat room is unavailable.'
        ));
      }
    });

    socket.on('message:send', async (payload = {}, callback) => {
      if (!limiter(socket, 'message', env.socketMessageRateLimit)) {
        logEvent('warn', 'message_rate_limited', {
          actorCategory: socket.data.actor.category
        });
        acknowledge(callback, publicError('CHAT_RATE_LIMITED', 'Please wait before sending again.'));
        return;
      }
      const caseId = String(payload.caseId || '');
      try {
        const actor = await authorizeCase(socket, caseId, COMPLAINT_ACTIONS.CHAT_SEND);
        if (!socket.data.subscriptions.has(caseId)) throw new Error('ROOM_NOT_JOINED');
        const result = await persistChatMessage({
          complaintId: caseId,
          actor: {
            category: actor.category,
            ref: actor.ref,
            reporter: actor.type === 'reporter'
          },
          text: payload.text,
          attachments: payload.attachments,
          clientMessageId: payload.clientMessageId
        });
        const room = roomKey(caseId);
        const peers = (await io.in(room).fetchSockets()).filter((peer) => peer.id !== socket.id);
        if (!result.duplicate && peers.length > 0) {
          await ChatMessage.updateOne({ _id: result.message._id }, {
            deliveryState: 'delivered_to_connected_client',
            deliveredAt: new Date()
          });
          result.view.deliveryState = 'delivered_to_connected_client';
        }
        if (!result.duplicate) io.to(room).emit('message:created', result.view);
        await createAuditLog({
          role: actor.category, action: 'message_persisted',
          resourceType: 'complaint', resourceRef: caseId,
          details: {
            category: result.duplicate ? 'idempotent_replay' : 'persisted',
            contentLength: String(payload.text || '').length
          }
        });
        acknowledge(callback, {
          ok: true, message: result.view, duplicate: result.duplicate
        });
      } catch (error) {
        const code = error?.code || error?.message || 'CHAT_SEND_DENIED';
        if (/ATTACHMENT/.test(code)) logEvent('warn', 'attachment_reference_rejected', {
          actorCategory: socket.data.actor.category
        });
        acknowledge(callback, publicError(
          code === 'SOCKET_SESSION_EXPIRED' ? code : 'CHAT_SEND_DENIED',
          'The message could not be sent.'
        ));
      }
    });

    socket.on('history:sync', async (payload = {}, callback) => {
      if (!limiter(socket, 'history', 20)) {
        acknowledge(callback, publicError('SOCKET_RATE_LIMITED', 'Too many history requests.'));
        return;
      }
      const caseId = String(payload.caseId || '');
      try {
        const actor = await authorizeCase(socket, caseId, COMPLAINT_ACTIONS.CHAT_READ);
        if (!socket.data.subscriptions.has(caseId)) throw new Error('ROOM_NOT_JOINED');
        const messages = await listChatMessages({
          complaintId: caseId,
          actor: {
            category: actor.category, ref: actor.ref,
            reporter: actor.type === 'reporter'
          },
          afterSequence: payload.afterSequence,
          limit: payload.limit
        });
        acknowledge(callback, {
          ok: true, messages,
          nextCursor: messages.at(-1)?.sequence ?? (Number(payload.afterSequence) || 0)
        });
      } catch {
        acknowledge(callback, publicError('RESOURCE_ACCESS_DENIED', 'History is unavailable.'));
      }
    });

    socket.on('message:read', async (payload = {}, callback) => {
      if (!limiter(socket, 'read', 30)) {
        acknowledge(callback, publicError('SOCKET_RATE_LIMITED', 'Too many read updates.'));
        return;
      }
      const caseId = String(payload.caseId || '');
      try {
        const actor = await authorizeCase(socket, caseId, COMPLAINT_ACTIONS.CHAT_MARK_READ);
        if (!socket.data.subscriptions.has(caseId)) throw new Error('ROOM_NOT_JOINED');
        const receipt = await markMessagesRead({
          complaintId: caseId,
          actor: {
            category: actor.category, ref: actor.ref,
            reporter: actor.type === 'reporter'
          },
          throughSequence: payload.throughSequence
        });
        io.to(roomKey(caseId)).emit('message:read', {
          throughSequence: receipt.throughSequence,
          readerCategory: actor.category
        });
        acknowledge(callback, { ok: true, receipt });
      } catch {
        acknowledge(callback, publicError('RESOURCE_ACCESS_DENIED', 'Read update denied.'));
      }
    });

    socket.on('typing:set', async (payload = {}) => {
      if (!limiter(socket, 'typing', 20, 10_000)) return;
      const caseId = String(payload.caseId || '');
      try {
        const actor = await authorizeCase(socket, caseId, COMPLAINT_ACTIONS.CHAT_SEND);
        if (!socket.data.subscriptions.has(caseId)) return;
        socket.to(roomKey(caseId)).emit('typing:changed', {
          actorCategory: actor.category, state: payload.state === true
        });
      } catch {
        // Typing is ephemeral; denied events receive no detail.
      }
    });
  });

  registerRealtimeRevocationHandler(async ({
    complaintId, actorCategory = null, actorRef = null
  }) => {
    const room = roomKey(complaintId);
    const sockets = await io.in(room).fetchSockets();
    for (const socket of sockets) {
      const actor = socket.data.actor;
      if (actor.type === 'reporter') continue;
      if (actorCategory && actor.category !== actorCategory) continue;
      if (actorRef && actor.ref !== actorRef) continue;
      await socket.leave(room);
      socket.data.subscriptions.delete(complaintId);
      socket.emit('access:revoked', {
        caseRef: safeResourceRef(complaintId), state: 'revoked'
      });
      await createAuditLog({
        role: 'system', action: 'socket_access_revoked',
        resourceType: 'complaint', resourceRef: complaintId,
        details: { category: actor.category }
      });
    }
  });
  registerRealtimePublishHandler(async ({ complaintId, eventName, payload }) => {
    const room = roomKey(complaintId);
    const sockets = await io.in(room).fetchSockets();
    for (const socket of sockets) {
      try {
        await authorizeCase(socket, complaintId, COMPLAINT_ACTIONS.SOS_READ);
        socket.emit(eventName, payload);
      } catch {
        await socket.leave(room);
        socket.data.subscriptions.delete(complaintId);
      }
    }
  });
  return io;
}
