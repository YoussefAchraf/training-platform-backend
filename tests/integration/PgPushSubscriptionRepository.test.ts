

import { PgPushSubscriptionRepository } from '../../src/infrastructure/repositories/PgPushSubscriptionRepository';
import { prismaClient } from '../../src/infrastructure/database/prismaClient';

describe('PgPushSubscriptionRepository (Prisma, real database)', () => {
  const repository = new PgPushSubscriptionRepository(prismaClient);
  const marker = `push-sub-test-${Date.now()}`;
  const endpoint = `https://example.com/${marker}`;
  let userId: number;
  let otherUserId: number;

  beforeAll(async () => {
    const role = await prismaClient.roles.findFirstOrThrow();
    const user = await prismaClient.users.create({
      data: { firstname: 'Push', lastname: 'Tester', email: `${marker}@example.com`, password_hash: 'x', role_id: role.id },
    });
    userId = user.id;
    const other = await prismaClient.users.create({
      data: { firstname: 'Push', lastname: 'Other', email: `${marker}-other@example.com`, password_hash: 'x', role_id: role.id },
    });
    otherUserId = other.id;
  });

  afterAll(async () => {
    await prismaClient.push_subscriptions.deleteMany({ where: { user_id: { in: [userId, otherUserId] } } });
    await prismaClient.users.deleteMany({ where: { id: { in: [userId, otherUserId] } } });
    await prismaClient.$disconnect();
  });

  it('creates a subscription and lists it for that user', async () => {
    await repository.create({ userId, endpoint, p256dh: 'key1', auth: 'auth1' });

    const results = await repository.listByUserId(userId);
    expect(results).toHaveLength(1);
    expect(results[0].endpoint).toBe(endpoint);
  });

  it('re-subscribing the same endpoint under a different user re-points it (upsert), not a duplicate', async () => {
    await repository.create({ userId: otherUserId, endpoint, p256dh: 'key2', auth: 'auth2' });

    expect(await repository.listByUserId(userId)).toHaveLength(0);
    const results = await repository.listByUserId(otherUserId);
    expect(results).toHaveLength(1);
    expect(results[0].p256dh).toBe('key2');
  });

  it('deleteByEndpointForUser only removes it for the matching user', async () => {
    await repository.deleteByEndpointForUser(endpoint, userId);
    expect(await repository.listByUserId(otherUserId)).toHaveLength(1);

    await repository.deleteByEndpointForUser(endpoint, otherUserId);
    expect(await repository.listByUserId(otherUserId)).toHaveLength(0);
  });
});
