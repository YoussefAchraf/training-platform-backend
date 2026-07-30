import request from 'supertest';
import { buildApp } from '../../src/app';
import { pool } from '../../src/infrastructure/database/connection';
import { redis } from '../../src/infrastructure/cache/RedisClient';





describe('app smoke tests', () => {
  const { app } = buildApp();

  afterAll(async () => {
    await pool.end();
    await redis.quit();
  });

  it('GET /health returns 200 ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });

  it('GET /unknown-route returns 404', async () => {
    const res = await request(app).get('/unknown-route');
    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error');
  });

  it('rejects a protected route with no Authorization header', async () => {
    const res = await request(app).get('/providers');
    expect(res.status).toBe(401);
  });

  it('rejects signup with an invalid role before touching the database', async () => {
    const res = await request(app).post('/auth/signup').send({
      firstname: 'Test',
      lastname: 'User',
      email: 'smoke-test@example.com',
      password: 'password123',
      role: 'NotARealRole',
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/role must be one of/);
  });
});
