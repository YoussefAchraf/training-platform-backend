import { PushSubscription } from '../../domain/entities/PushSubscription';
import { IPushSubscriptionRepository } from '../../domain/interfaces/IPushSubscriptionRepository';

function mapRow(row) {
  if (!row) return null;
  return new PushSubscription({
    id: row.id,
    userId: row.user_id,
    endpoint: row.endpoint,
    p256dh: row.p256dh,
    auth: row.auth,
    createdAt: row.created_at,
  });
}

class PgPushSubscriptionRepository extends IPushSubscriptionRepository {
  prisma: any;

  constructor(prisma) {
    super();
    this.prisma = prisma;
  }

  async create({ userId, endpoint, p256dh, auth }) {
    const row = await this.prisma.push_subscriptions.upsert({
      where: { endpoint },
      create: { user_id: userId, endpoint, p256dh, auth },
      update: { user_id: userId, p256dh, auth },
    });
    return mapRow(row);
  }

  async deleteByEndpointForUser(endpoint, userId) {
    await this.prisma.push_subscriptions.deleteMany({ where: { endpoint, user_id: userId } });
  }

  async listByUserId(userId) {
    const rows = await this.prisma.push_subscriptions.findMany({ where: { user_id: userId } });
    return rows.map(mapRow);
  }
}

export { PgPushSubscriptionRepository };
