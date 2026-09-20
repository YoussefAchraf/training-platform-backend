import express from 'express';
import request from 'supertest';
import securityHeadersMiddleware from '../../../src/interface/middlewares/securityHeadersMiddleware';

function buildApp() {
  const app = express();
  app.use(securityHeadersMiddleware);
  app.get('/health', (_req, res) => res.json({ status: 'ok' }));
  app.get('/api-docs', (_req, res) => res.send('<html></html>'));
  return app;
}

describe('securityHeadersMiddleware', () => {
  it('sends hardening headers and hides the framework on API responses', async () => {
    const res = await request(buildApp()).get('/health');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-powered-by']).toBeUndefined();
    expect(res.headers['strict-transport-security']).toMatch(/max-age=15552000/);
    expect(res.headers['referrer-policy']).toBe('no-referrer');
    expect(res.headers['content-security-policy']).toMatch(/default-src 'none'/);
    expect(res.headers['content-security-policy']).toMatch(/frame-ancestors 'none'/);
  });

  it('allows the frontend origin to load API resources (attachments, images) cross-origin', async () => {
    const res = await request(buildApp()).get('/health');
    expect(res.headers['cross-origin-resource-policy']).toBe('cross-origin');
  });

  it('does not apply the strict CSP to the Swagger UI, which needs inline scripts', async () => {
    const res = await request(buildApp()).get('/api-docs');
    expect(res.headers['content-security-policy']).toBeUndefined();
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });
});
