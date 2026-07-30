import rateLimit from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';




export default function createRateLimiter({
  redisClient,
  windowMs,
  limit,
  message = 'Too many requests, please try again later.',
  prefix,
}) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: message },
    store: new RedisStore({
      
      
      
      prefix: `rl:${prefix}:`,
      sendCommand: (...args: string[]) => redisClient.call(...args),
    }),
  });
};
