import request from 'supertest';
import { buildApp } from '../../src/app';
import { pool } from '../../src/infrastructure/database/connection';
import { prismaClient } from '../../src/infrastructure/database/prismaClient';
import { redis } from '../../src/infrastructure/cache/RedisClient';


jest.mock('../../src/interface/middlewares/rateLimitMiddleware', () => ({
  __esModule: true,
  default: () => (_req: unknown, res: { status: (code: number) => { json: (body: unknown) => void } }) =>
    res.status(429).json({ error: 'Too many requests' }),
}));

describe('/health and rate limiting', () => {
  const { app } = buildApp();

  afterAll(async () => {
    await prismaClient.$disconnect();
    await pool.end();
    await redis.quit();
  });

  it('answers the kubelet probes even when the rate limiters are exhausted', async () => {
    const res = await request(app).get('/health');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });

  it('control: the same limiters do reject an ordinary route, so the test is meaningful', async () => {
    const res = await request(app).get('/providers');

    expect(res.status).toBe(429);
  });
});
