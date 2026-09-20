import cookieParser from 'cookie-parser';
import express from 'express';
import request from 'supertest';
import requestValidationMiddleware, { RULES } from '../../../src/interface/middlewares/requestValidationMiddleware';

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use(requestValidationMiddleware);
  app.all(/.*/, (req, res) => res.status(200).json({ body: req.body }));
  return app;
}

const authed = (req: request.Test) => req.set('Cookie', 'accessToken=anything');

describe('requestValidationMiddleware', () => {
  describe('public endpoints validate without credentials', () => {
    it('normalizes account emails (trim + lowercase) and leaves passwords untouched', async () => {
      const res = await request(buildApp())
        .post('/auth/login')
        .send({ email: '  Foo@Example.COM ', password: '  Pass Word! ' });
      expect(res.status).toBe(200);
      expect(res.body.body).toEqual({ email: 'foo@example.com', password: '  Pass Word! ' });
    });

    it('rejects wrong types instead of letting them reach the database layer', async () => {
      const res = await request(buildApp()).post('/auth/login').send({ email: { $ne: null }, password: ['x'] });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/^email: /);
      expect(res.body.details.map((d: any) => d.field).sort()).toEqual(['email', 'password']);
    });

    it('rejects oversized input (signup, reset password, survey)', async () => {
      const app = buildApp();
      expect((await request(app).post('/auth/signup').send({ firstname: 'x'.repeat(101) })).status).toBe(400);
      expect((await request(app).post('/auth/login').send({ email: 'a@b.c', password: 'p'.repeat(129) })).status).toBe(400);
      expect((await request(app).post('/survey/5/submit').send({ instructorScore: 5.5 })).status).toBe(400);
      expect((await request(app).post('/survey/5/submit').send({ instructorScore: 5, npsScore: 9, comments: 'c'.repeat(5001) })).status).toBe(400);
    });

    it('keeps presence checks for the use cases: a missing field is not a validation error', async () => {
      const res = await request(buildApp()).post('/auth/signup').send({});
      expect(res.status).toBe(200);
    });

    it('strips unknown fields (mass-assignment protection)', async () => {
      const res = await request(buildApp())
        .post('/auth/signup')
        .send({ firstname: 'A', lastname: 'B', email: 'a@b.c', password: 'x', role: 'Sales', status: 'approved', role_id: 4, isAdmin: true });
      expect(res.body.body).toEqual({ firstname: 'A', lastname: 'B', email: 'a@b.c', password: 'x', role: 'Sales' });
    });
  });

  describe('protected endpoints', () => {
    it('does not validate for unauthenticated callers, so the auth middleware still answers 401 first', async () => {
      const res = await request(buildApp()).post('/providers').send({ name: 12345 });
      expect(res.status).toBe(200);
      expect(res.body.body).toEqual({ name: 12345 });
    });

    it('validates for authenticated callers (cookie or bearer)', async () => {
      const app = buildApp();
      expect((await authed(request(app).post('/providers')).send({ name: 12345 })).status).toBe(400);
      expect((await request(app).post('/providers').set('Authorization', 'Bearer x').send({ name: 12345 })).status).toBe(400);
    });

    it('accepts numeric-string ids and converts them, but never coerces null into 0', async () => {
      const app = buildApp();
      const ok = await authed(request(app).post('/trainings')).send({ name: 'T', providerId: '12', duration: null });
      expect(ok.body.body).toEqual({ name: 'T', providerId: 12, duration: null });
      const zero = await authed(request(app).patch('/trainings/3')).send({ duration: 0, durationUnit: 'days' });
      expect(zero.body.body).toEqual({ duration: 0, durationUnit: 'days' });
      expect((await authed(request(app).post('/trainings')).send({ providerId: 'abc' })).status).toBe(400);
      expect((await authed(request(app).post('/trainings')).send({ providerId: -1 })).status).toBe(400);
      expect((await authed(request(app).patch('/trainings/3')).send({ duration: -1 })).status).toBe(400);
    });

    it('enforces column-sized limits so oversized values fail cleanly instead of as database errors', async () => {
      const app = buildApp();
      expect((await authed(request(app).post('/clients')).send({ companyName: 'c'.repeat(151) })).status).toBe(400);
      expect((await authed(request(app).post('/clients')).send({ companyName: 'ok', country: 'FRA' })).status).toBe(400);
      expect((await authed(request(app).post('/providers')).send({ name: 'p', logoUrl: 'u'.repeat(501) })).status).toBe(400);
      expect((await authed(request(app).post('/sessions/1/attendees')).send({ name: 'n'.repeat(151) })).status).toBe(400);
    });

    it('keeps every field the controllers read (nothing is silently stripped)', async () => {
      const app = buildApp();
      const cases: Array<[string, string, Record<string, unknown>]> = [
        ['post', '/sessions', { trainingId: 1, clientId: 2, startDate: '2030-01-01T09:00:00Z', endDate: '2030-01-01T17:00:00Z', includeWeekends: true, locationType: 'remote', teachingLanguage: 'english' }],
        ['patch', '/sessions/1', { startDate: '2030-01-01T09:00:00Z', endDate: '2030-01-01T17:00:00Z', includeWeekends: false, locationType: 'onsite', teachingLanguage: 'french' }],
        ['post', '/sessions/1/assign-instructor', { instructorId: 4 }],
        ['post', '/sessions/1/attendees', { name: 'A', email: 'a@b.c' }],
        ['patch', '/sessions/1/attendees/2', { name: 'A', email: 'a@b.c' }],
        ['patch', '/sessions/1/attendees/2/attendance', { status: 'present' }],
        ['post', '/sessions/1/notes', { body: 'note' }],
        ['patch', '/sessions/1/notes/2', { body: 'note' }],
        ['post', '/providers', { name: 'P', description: 'd', logoUrl: 'https://x/y.png' }],
        ['post', '/trainings', { name: 'T', providerId: 1, description: 'd', duration: 3, durationUnit: 'days' }],
        ['post', '/clients', { companyName: 'C', email: 'c@d.e', phone: '+33123456789', country: 'FR' }],
        ['patch', '/calendar/global/1', { eventDate: '2030-01-01T09:00:00Z', endDate: '2030-01-02T09:00:00Z', title: 'T' }],
        ['post', '/feedback', { category: 'bug', message: 'm' }],
        ['post', '/announcements', { title: 'T', description: 'D', targetRoles: ['Sales'] }],
        ['patch', '/announcements/1/rate', { stars: 5 }],
        ['post', '/push/subscribe', { endpoint: 'https://p/1', keys: { p256dh: 'k', auth: 'a' }, silent: true }],
        ['post', '/push/unsubscribe', { endpoint: 'https://p/1' }],
        ['patch', '/instructors/me', { bio: 'b', skills: [{ trainingId: 3, certificateId: 'C1', certificateExpiresAt: '2031-01-01' }] }],
        ['patch', '/auth/me', { firstname: 'A', lastname: 'B', hasSeenTour: true }],
        ['patch', '/auth/me/password', { currentPassword: 'a', newPassword: 'b' }],
        ['patch', '/admin/users/3', { firstname: 'A', lastname: 'B', email: 'a@b.c', role: 'Sales', status: 'approved' }],
        ['post', '/auth/reset-password', { token: 't', newPassword: 'p' }],
        ['post', '/messaging/conversations/direct', { targetUserId: 2 }],
        ['post', '/messaging/conversations/group', { name: 'G', memberUserIds: [2, 3] }],
        ['post', '/messaging/conversations/1/participants', { userId: 2 }],
        ['post', '/messaging/conversations/1/read', { messageId: 9 }],
        ['post', '/messaging/conversations/1/mute', { muted: true }],
        ['post', '/messaging/conversations/1/messages', { type: 'text', body: 'hi', replyToMessageId: 3 }],
        ['post', '/messaging/conversations/1/uploads', { type: 'file', originalName: 'a.pdf', sizeBytes: 1234 }],
        ['post', '/messaging/uploads/abc/complete', { replyToMessageId: 3 }],
        ['post', '/messaging/messages/1/translate', { targetLanguage: 'fr' }],
        ['post', '/messaging/messages/1/forward', { targetConversationId: 4 }],
        ['patch', '/messaging/messages/1', { body: 'edited' }],
        ['post', '/survey/5/submit', { attendeeId: 7, instructorScore: 5, npsScore: 9, comments: 'c' }],
      ];
      for (const [method, url, payload] of cases) {
        const res = await authed((request(app) as any)[method](url)).send(payload);
        expect({ url, status: res.status, body: res.body.body }).toEqual({ url, status: 200, body: payload });
      }
    });

    it('does not validate multipart uploads (multer parses those after this middleware)', async () => {
      const res = await authed(request(buildApp()).post('/messaging/conversations/1/messages'))
        .field('type', 'image')
        .attach('file', Buffer.from('x'), 'a.png');
      expect(res.status).toBe(200);
    });
  });

  describe('identifiers in the path', () => {
    it('rejects numeric ids that overflow a 32-bit integer', async () => {
      const app = buildApp();
      expect((await request(app).get('/sessions/2147483648')).status).toBe(400);
      expect((await request(app).get('/sessions/99999999999999999999')).status).toBe(400);
      expect((await request(app).get('/sessions/2147483647')).status).toBe(200);
      expect((await request(app).get('/messaging/uploads/6f1d2c9e-aaaa-4bbb-8ccc-000000000000/status')).status).toBe(200);
    });
  });

  it('documents each rule with a unique method+path so none silently shadows another', () => {
    const keys = RULES.map((rule) => `${rule.method} ${rule.pattern.source}`);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
