import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: 3,
});

redis.on('error', (err: Error) => {
  console.error('Unexpected Redis client error', err);
});

export { redis };
