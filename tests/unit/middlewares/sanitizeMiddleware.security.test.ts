import express from 'express';
import request from 'supertest';
import sanitizeMiddleware from '../../../src/interface/middlewares/sanitizeMiddleware';

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(sanitizeMiddleware);
  app.post('/echo', (req, res) => res.status(200).json({ body: req.body, pollutedGlobally: ({} as any).polluted === true }));
  return app;
}

describe('sanitizeMiddleware (HTTP-level security cases)', () => {
  it('trims strings and strips HTML from ordinary fields', async () => {
    const res = await request(buildApp()).post('/echo').send({ name: '  <b>Bob</b><script>alert(1)</script> ', nested: { note: ' <i>x</i> ' }, list: [' a ', '<u>b</u>'] });
    expect(res.body.body).toEqual({ name: 'Bob', nested: { note: 'x' }, list: ['a', 'b'] });
  });

  it('never alters any password field, so what the user typed is what gets hashed', async () => {
    const payload = { password: '  pa<ss>word  ', newPassword: '  n<e>w  ', currentPassword: ' <c>ur ', refreshToken: ' t ' };
    const res = await request(buildApp()).post('/echo').send(payload);
    expect(res.body.body).toEqual(payload);
  });

  it('drops prototype-pollution keys and cannot pollute Object.prototype', async () => {
    const res = await request(buildApp())
      .post('/echo')
      .set('Content-Type', 'application/json')
      .send('{"a":1,"__proto__":{"polluted":true},"constructor":{"prototype":{"polluted":true}},"nested":{"__proto__":{"polluted":true},"ok":2}}');
    expect(res.body.body).toEqual({ a: 1, nested: { ok: 2 } });
    expect(res.body.pollutedGlobally).toBe(false);
    expect(({} as any).polluted).toBeUndefined();
  });
});
