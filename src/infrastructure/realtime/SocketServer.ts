import { Server as SocketIOServer } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { MESSAGING_ALLOWED_ROLES } from '../../domain/constants/messagingRoles';

function parseCookieHeader(header) {
  const cookies: Record<string, string> = {};
  if (!header) return cookies;
  header.split(';').forEach((pair) => {
    const index = pair.indexOf('=');
    if (index === -1) return;
    const key = pair.slice(0, index).trim();
    const value = pair.slice(index + 1).trim();
    if (key) {
      try {
        cookies[key] = decodeURIComponent(value);
      } catch {
        cookies[key] = value;
      }
    }
  });
  return cookies;
}

function conversationRoom(conversationId) {
  return `conversation:${conversationId}`;
}

function userRoom(userId) {
  return `user:${userId}`;
}




function createMessagingSocketServer(
  httpServer,
  { tokenService, userRepository, conversationRepository, presenceStore, redisAdapter = undefined }
) {
  const io = new SocketIOServer(httpServer, {
    cors: { origin: process.env.CLIENT_URL, credentials: true },
  });

  if (redisAdapter) {
    io.adapter(createAdapter(redisAdapter.pub, redisAdapter.sub));
  }

  const messaging = io.of('/messaging');

  messaging.use(async (socket, next) => {
    try {
      const cookies = parseCookieHeader(socket.handshake.headers.cookie);
      const token = cookies.accessToken || socket.handshake.auth?.token;
      if (!token) {
        return next(new Error('Unauthorized'));
      }

      const decoded = tokenService.verifyAccessToken(token);
      const user = await userRepository.findById(decoded.userId);
      if (!user || !user.isApproved()) {
        return next(new Error('Unauthorized'));
      }
      if (user.isSuperAdmin()) {
        return next(new Error('Forbidden'));
      }
      if (!MESSAGING_ALLOWED_ROLES.includes(user.roleName)) {
        return next(new Error('Forbidden'));
      }

      socket.data.user = user;
      next();
    } catch {
      next(new Error('Unauthorized'));
    }
  });

  messaging.on('connection', (socket) => {
    const { user } = socket.data;

    void (async () => {
      socket.join(userRoom(user.id));
      if (presenceStore) {
        await presenceStore.markOnline(user.id, socket.id);
      }

      const conversations = await conversationRepository.listForUser(user.id);
      conversations.forEach((conversation) => socket.join(conversationRoom(conversation.id)));
    })();

    async function relayIfParticipant(event, conversationId) {
      if (!conversationId) return;
      const isParticipant = await conversationRepository.isParticipant(conversationId, user.id);
      if (!isParticipant) return;
      socket.to(conversationRoom(conversationId)).emit(event, { conversationId, userId: user.id });
    }

    socket.on('typing:start', ({ conversationId }) => relayIfParticipant('typing:start', conversationId));
    socket.on('typing:stop', ({ conversationId }) => relayIfParticipant('typing:stop', conversationId));
    socket.on('recording:start', ({ conversationId }) => relayIfParticipant('recording:start', conversationId));
    socket.on('recording:stop', ({ conversationId }) => relayIfParticipant('recording:stop', conversationId));

    socket.on('message:delivered', async ({ conversationId, messageId }) => {
      if (!conversationId || !messageId) return;
      const isParticipant = await conversationRepository.isParticipant(conversationId, user.id);
      if (!isParticipant) return;
      const participant = await conversationRepository.markDelivered(conversationId, user.id, messageId);
      messaging.to(conversationRoom(conversationId)).emit('conversation:delivered', {
        conversationId,
        userId: participant.userId,
        lastDeliveredMessageId: participant.lastDeliveredMessageId,
        lastDeliveredAt: participant.lastDeliveredAt,
      });
    });

    socket.on('disconnect', () => {
      if (presenceStore) {
        presenceStore.markOffline(user.id, socket.id).catch((err) => {
          console.error('[SocketServer] Failed to clear presence on disconnect:', err.message);
        });
      }
    });
  });

  return { io, messaging };
}

export { createMessagingSocketServer, conversationRoom, userRoom };
