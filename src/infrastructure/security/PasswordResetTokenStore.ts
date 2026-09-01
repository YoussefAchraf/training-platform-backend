import crypto from 'crypto';

function hash(token: string) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function ttlSeconds() {
  const minutes = Number(process.env.PASSWORD_RESET_TOKEN_TTL_MINUTES) || 60;
  return minutes * 60;
}

class PasswordResetTokenStore {
  redisClient: any;

  constructor({ redisClient }) {
    this.redisClient = redisClient;
  }

  async issue(userId) {
    const token = crypto.randomBytes(32).toString('base64url');
    const tokenHash = hash(token);
    await this.redisClient.set(`pwreset:${tokenHash}`, String(userId), 'EX', ttlSeconds());
    return token;
  }

  async consume(token) {
    if (!token) return null;
    const tokenHash = hash(token);
    const key = `pwreset:${tokenHash}`;
    const userId = await this.redisClient.call('GETDEL', key);
    return userId ? Number(userId) : null;
  }
}

export { PasswordResetTokenStore };
