import http from 'http';
import { AddressInfo } from 'net';
import Redis from 'ioredis';
import { io as connect, Socket } from 'socket.io-client';
import { createMessagingSocketServer } from '../../src/infrastructure/realtime/SocketServer';
import { MESSAGING_ALLOWED_ROLES } from '../../src/domain/constants/messagingRoles';



const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

function stubDeps() {
  const user = { id: 42, roleName: MESSAGING_ALLOWED_ROLES[0], isApproved: () => true, isSuperAdmin: () => false };
  return {
    tokenService: { verifyAccessToken: () => ({ userId: user.id }) },
    userRepository: { findById: async () => user },
    conversationRepository: { listForUser: async () => [], isParticipant: async () => true, markDelivered: async () => ({}) },
    presenceStore: null,
  };
}

async function startPod(withAdapter: boolean) {
  const clients: Redis[] = [];
  let redisAdapter;
  if (withAdapter) {
    const pub = new Redis(REDIS_URL);
    const sub = pub.duplicate();
    clients.push(pub, sub);
    redisAdapter = { pub, sub };
  }
  const server = http.createServer();
  const { io, messaging } = createMessagingSocketServer(server, { ...stubDeps(), redisAdapter });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = (server.address() as AddressInfo).port;
  return {
    port,
    messaging,
    async stop() {
      await new Promise<void>((resolve) => io.close(() => resolve()));
      await Promise.all(clients.map((c) => c.quit().catch(() => undefined)));
    },
  };
}

async function waitFor(check: () => Promise<boolean> | boolean, ms = 4000) {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    if (await check()) return true;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  return false;
}

async function relayedToClientOnPodB(withAdapter: boolean): Promise<boolean> {
  const podA = await startPod(withAdapter);
  const podB = await startPod(withAdapter);
  let client: Socket | undefined;
  try {
    const received: unknown[] = [];
    client = connect(`http://127.0.0.1:${podB.port}/messaging`, { transports: ['websocket'], auth: { token: 'any' }, reconnection: false });
    client.on('probe', (payload) => received.push(payload));

    
    expect(await waitFor(async () => (await podB.messaging.in('user:42').fetchSockets()).length === 1)).toBe(true);

    
    let sent = 0;
    return await waitFor(() => {
      if (received.length === 0) {
        sent += 1;
        podA.messaging.to('user:42').emit('probe', { n: sent });
      }
      return received.length > 0;
    }, 3000);
  } finally {
    client?.close();
    await podA.stop();
    await podB.stop();
  }
}

describe('Socket.IO live events across two backend pods (real Redis)', () => {
  it('with the Redis adapter, an event emitted by pod A reaches a client connected to pod B', async () => {
    expect(await relayedToClientOnPodB(true)).toBe(true);
  }, 20_000);

  it('without the adapter it does not (this is exactly the gap the adapter closes)', async () => {
    expect(await relayedToClientOnPodB(false)).toBe(false);
  }, 20_000);
});
