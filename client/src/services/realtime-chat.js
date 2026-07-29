import { io } from 'socket.io-client';

function socketOrigin() {
  const configured = import.meta.env.VITE_SOCKET_URL?.trim();
  if (configured) return configured.replace(/\/+$/, '');
  return typeof window === 'undefined' ? 'http://127.0.0.1:5000' : window.location.origin;
}

export function createCaseChatSocket({
  credentialType, token, caseId, afterSequence = 0,
  onMessage, onRead, onRevoked, onSos, onState
}) {
  const socket = io(socketOrigin(), {
    auth: { credentialType, token },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 500,
    reconnectionDelayMax: 4000
  });
  socket.on('connect', () => {
    onState?.('connected');
    socket.emit('case:join', { caseId }, (joined) => {
      if (!joined?.ok) {
        onState?.('access_denied');
        return;
      }
      socket.emit('history:sync', { caseId, afterSequence }, (history) => {
        if (history?.ok) history.messages.forEach((message) => onMessage?.(message));
      });
    });
  });
  socket.on('disconnect', (reason) => {
    onState?.(reason === 'io client disconnect' ? 'closed' : 'reconnecting');
  });
  socket.on('connect_error', (error) => {
    onState?.(error?.message === 'SOCKET_AUTH_INVALID' ? 'session_expired' : 'reconnecting');
  });
  socket.on('message:created', (message) => onMessage?.(message));
  socket.on('message:read', (receipt) => onRead?.(receipt));
  socket.on('access:revoked', (event) => {
    onState?.('access_revoked');
    onRevoked?.(event);
  });
  socket.on('sos:state_changed', (event) => onSos?.(event));
  return socket;
}

export function sendRealtimeMessage(socket, payload) {
  return new Promise((resolve, reject) => {
    if (!socket?.connected) {
      reject(new Error('Real-time chat is reconnecting.'));
      return;
    }
    socket.timeout(5000).emit('message:send', payload, (error, result) => {
      if (error || !result?.ok) {
        const failure = new Error(result?.message || 'The message could not be sent.');
        failure.code = result?.code;
        reject(failure);
        return;
      }
      resolve(result);
    });
  });
}
