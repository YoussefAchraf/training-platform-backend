class PresenceStore {
  redis: any;

  constructor({ redis }) {
    this.redis = redis;
  }

  async markOnline(userId, socketId) {
    await this.redis.sadd(`presence:${userId}`, socketId);
  }

  async markOffline(userId, socketId) {
    await this.redis.srem(`presence:${userId}`, socketId);
  }

  async isOnline(userId) {
    const count = await this.redis.scard(`presence:${userId}`);
    return count > 0;
  }
}

export { PresenceStore };
