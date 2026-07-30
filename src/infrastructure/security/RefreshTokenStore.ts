import crypto from 'crypto';

function hash(token: string) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function ttlSeconds() {
  const days = Number(process.env.REFRESH_TOKEN_TTL_DAYS) || 30;
  return days * 24 * 60 * 60;
}





class RefreshTokenStore {
  redisClient: any;

  constructor({ redisClient }) {
    this.redisClient = redisClient;
  }

  async issue(userId) {
    const token = crypto.randomBytes(48).toString('base64url');
    const tokenHash = hash(token);
    const ttl = ttlSeconds();

    await this.redisClient
      .multi()
      .set(`refresh:${tokenHash}`, String(userId), 'EX', ttl)
      .sadd(`refresh:user:${userId}`, tokenHash)
      .exec();

    return token;
  }

  async verify(token) {
    if (!token) return null;
    const userId = await this.redisClient.get(`refresh:${hash(token)}`);
    return userId ? Number(userId) : null;
  }

  async revoke(token) {
    if (!token) return;
    const tokenHash = hash(token);
    const userId = await this.redisClient.get(`refresh:${tokenHash}`);
    const multi = this.redisClient.multi().del(`refresh:${tokenHash}`);
    if (userId) multi.srem(`refresh:user:${userId}`, tokenHash);
    await multi.exec();
  }

  async revokeAllForUser(userId) {
    const hashes = await this.redisClient.smembers(`refresh:user:${userId}`);
    if (hashes.length === 0) return;
    const multi = this.redisClient.multi();
    for (const tokenHash of hashes) {
      multi.del(`refresh:${tokenHash}`);
    }
    multi.del(`refresh:user:${userId}`);
    await multi.exec();
  }
}

export { RefreshTokenStore };
