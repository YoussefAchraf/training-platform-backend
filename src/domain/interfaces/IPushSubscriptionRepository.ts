import { notImplemented } from './notImplemented';

class IPushSubscriptionRepository {
  async create(subscription): Promise<any> { notImplemented('IPushSubscriptionRepository', 'create'); }
  async deleteByEndpointForUser(endpoint, userId): Promise<any> { notImplemented('IPushSubscriptionRepository', 'deleteByEndpointForUser'); }
  async listByUserId(userId): Promise<any> { notImplemented('IPushSubscriptionRepository', 'listByUserId'); }
}

export { IPushSubscriptionRepository };
