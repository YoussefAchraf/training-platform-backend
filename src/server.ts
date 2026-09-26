import 'dotenv/config';
import express from 'express';
import http from 'http';
import { pool } from './infrastructure/database/connection';
import { redis } from './infrastructure/cache/RedisClient';
import { prismaClient } from './infrastructure/database/prismaClient';
import { TokenService } from './infrastructure/security/TokenService';
import { PgUserRepository } from './infrastructure/repositories/PgUserRepository';
import { PgConversationRepository } from './infrastructure/repositories/PgConversationRepository';
import { PresenceStore } from './infrastructure/services/PresenceStore';
import { createMessagingSocketServer } from './infrastructure/realtime/SocketServer';
import { MessagingRealtimeGateway } from './infrastructure/realtime/MessagingRealtimeGateway';
import { buildApp } from './app';

const presenceStore = new PresenceStore({ redis });



const socketRedisSub = process.env.SOCKET_REDIS_ADAPTER === 'true' ? redis.duplicate() : null;
if (socketRedisSub) {
  socketRedisSub.on('error', (err: Error) => {
    console.error('Unexpected Socket.IO Redis subscriber error', err);
  });
}

const app = express();
const httpServer = http.createServer(app);
const { messaging } = createMessagingSocketServer(httpServer, {
  tokenService: new TokenService(),
  userRepository: new PgUserRepository(prismaClient),
  conversationRepository: new PgConversationRepository(prismaClient),
  presenceStore,
  redisAdapter: socketRedisSub ? { pub: redis, sub: socketRedisSub } : undefined,
});
const messagingRealtime = new MessagingRealtimeGateway({ messaging });

const { reportScheduler, sessionReminderScheduler, certificationExpiryScheduler, attachmentUploadGcScheduler } = buildApp({
  app,
  messagingRealtime,
  presenceStore,
});

const PORT = process.env.PORT || 4000;

httpServer.listen(PORT, () => {
  console.log(`Training platform API listening on port ${PORT}`);
  reportScheduler.start();
  sessionReminderScheduler.start();
  certificationExpiryScheduler.start();
  attachmentUploadGcScheduler.start();
});

function shutdown(signal: string) {
  console.log(`${signal} received, shutting down gracefully...`);
  httpServer.close(async (err?: Error) => {
    if (err) {
      console.error('Error while closing HTTP server', err);
      process.exitCode = 1;
    }
    try {
      await pool.end();
    } catch (poolErr) {
      console.error('Error while closing database pool', poolErr);
      process.exitCode = 1;
    }
    try {
      await redis.quit();
      if (socketRedisSub) await socketRedisSub.quit();
    } catch (redisErr) {
      console.error('Error while closing Redis connection', redisErr);
      process.exitCode = 1;
    }
    process.exit();
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
