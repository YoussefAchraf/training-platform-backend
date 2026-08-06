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
  pool: any;

  constructor(pool) {
    super();
    this.pool = pool;
  }

  
  
  
  async create({ userId, endpoint, p256dh, auth }) {
    const { rows } = await this.pool.query(
      `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (endpoint) DO UPDATE SET user_id = $1, p256dh = $3, auth = $4
       RETURNING *`,
      [userId, endpoint, p256dh, auth]
    );
    return mapRow(rows[0]);
  }

  
  
  
  async deleteByEndpointForUser(endpoint, userId) {
    await this.pool.query('DELETE FROM push_subscriptions WHERE endpoint = $1 AND user_id = $2', [endpoint, userId]);
  }

  async listByUserId(userId) {
    const { rows } = await this.pool.query(
      'SELECT * FROM push_subscriptions WHERE user_id = $1',
      [userId]
    );
    return rows.map(mapRow);
  }
}

export { PgPushSubscriptionRepository };
