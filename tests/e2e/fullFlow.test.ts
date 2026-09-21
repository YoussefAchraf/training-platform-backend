import request from 'supertest';
import { Pool } from 'pg';
import { buildApp } from '../../src/app';
import { pool } from '../../src/infrastructure/database/connection';
import { prismaClient } from '../../src/infrastructure/database/prismaClient';
import { redis } from '../../src/infrastructure/cache/RedisClient';
import { PasswordHasher } from '../../src/infrastructure/security/PasswordHasher';

const mockSendMail = jest.fn().mockResolvedValue({});
jest.mock('nodemailer', () => ({ createTransport: () => ({ sendMail: (...args: unknown[]) => mockSendMail(...args) }) }));
jest.mock('web-push', () => ({ setVapidDetails: jest.fn(), sendNotification: jest.fn().mockResolvedValue({}) }));

process.env.JWT_SECRET = process.env.JWT_SECRET || 'e2e-only-secret-not-used-anywhere-else';
process.env.TRUST_PROXY = 'true';
process.env.CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:3000';

const adminUrl = process.env.TEST_ADMIN_DATABASE_URL || process.env.MIGRATOR_DATABASE_URL || process.env.DATABASE_URL;
const random = () => Math.floor(Math.random() * 250) + 1;
const freshIp = () => `10.${random()}.${random()}.${random()}`;

function build() {
  return buildApp().app;
}

class Client {
  csrf = '';
  cookie = '';
  constructor(private app: ReturnType<typeof build>, private ip = freshIp()) {}
  private decorate(test: request.Test) {
    test.set('X-Forwarded-For', this.ip);
    if (this.cookie) test.set('Cookie', this.cookie);
    if (this.csrf) test.set('X-CSRF-Token', this.csrf);
    return test;
  }
  get(url: string) {
    return this.decorate(request(this.app).get(url));
  }
  post(url: string, body?: object) {
    return this.decorate(request(this.app).post(url)).send(body);
  }
  patch(url: string, body?: object) {
    return this.decorate(request(this.app).patch(url)).send(body);
  }
  async login(email: string, password: string, path = '/auth/login') {
    const res = await this.decorate(request(this.app).post(path)).send({ email, password });
    const setCookies = (res.headers['set-cookie'] as unknown as string[] | undefined) ?? [];
    if (setCookies.length > 0) {
      this.cookie = setCookies.map((c) => c.split(';')[0]).join('; ');
      const csrf = setCookies.find((c) => c.startsWith('csrfToken='));
      if (csrf) this.csrf = decodeURIComponent(csrf.split(';')[0].split('=')[1]);
    }
    return res;
  }
}

function ok(res: request.Response, status: number) {
  if (res.status !== status) throw new Error(`expected HTTP ${status} but got ${res.status}: ${JSON.stringify(res.body)}`);
}

describe('end-to-end: the real app, database and Redis', () => {
  const app = build();
  const admin = new Pool({ connectionString: adminUrl, max: 2 });
  const marker = `e2e${Date.now()}`;
  const hasher = new PasswordHasher();
  const password = 'Str0ng!Passw0rd-e2e';
  const email = (name: string) => `${marker}-${name}@example.test`;

  const ids = { manager: 0, developer: 0, instructorUser: 0, instructor2User: 0, instructor: 0, sales: 0, provider: 0, training: 0, training2: 0, client: 0, session: 0, session2: 0, attendee: 0, conversation: 0, announcement: 0 };
  const manager = new Client(app);
  const sales = new Client(app);
  const developer = new Client(app);
  const anonymous = new Client(app);

  async function createUser(name: string, role: string, status = 'approved') {
    const roleRow = await prismaClient.roles.findUniqueOrThrow({ where: { name: role } });
    return prismaClient.users.create({
      data: { firstname: name, lastname: 'E2E', email: email(name.toLowerCase()), password_hash: await hasher.hash(password), role_id: roleRow.id, status: status as any, approved_at: new Date() },
    });
  }

  beforeAll(async () => {
    ids.manager = (await createUser('Manager', 'Manager')).id;
    ids.developer = (await createUser('Developer', 'Developer')).id;
    const instructorUser = await createUser('Instructor', 'Instructor');
    ids.instructorUser = instructorUser.id;
    ids.instructor = (await prismaClient.instructors.create({ data: { user_id: instructorUser.id } })).id;
    ids.instructor2User = (await createUser('Instructortwo', 'Instructor')).id;
  });

  afterAll(async () => {
    const userIds = (await admin.query('SELECT id FROM users WHERE email LIKE $1', [`${marker}-%`])).rows.map((r) => r.id);
    await admin.query('DELETE FROM audit_log WHERE actor_id = ANY($1) OR (entity_type = $2 AND entity_id = ANY($1))', [userIds, 'User']);
    await admin.query('DELETE FROM training_sessions WHERE created_by = ANY($1)', [userIds]);
    await admin.query('DELETE FROM feature_announcements WHERE created_by = ANY($1)', [userIds]);
    await admin.query('DELETE FROM conversations WHERE created_by = ANY($1)', [userIds]);
    await admin.query('DELETE FROM trainings WHERE created_by = ANY($1)', [userIds]);
    await admin.query('DELETE FROM providers WHERE created_by = ANY($1) OR name LIKE $2', [userIds, `${marker}%`]);
    await admin.query('DELETE FROM clients WHERE created_by = ANY($1)', [userIds]);
    await admin.query('DELETE FROM users WHERE id = ANY($1)', [userIds]);
    await admin.end();
    await prismaClient.$disconnect();
    await pool.end();
    await redis.quit();
  });

  describe('request hygiene', () => {
    it('sends security headers and hides the framework', async () => {
      const res = await anonymous.get('/health');
      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.headers['x-powered-by']).toBeUndefined();
      expect(res.headers['content-security-policy']).toContain("default-src 'none'");
    });

    it('answers malformed and oversized JSON with 400 / 413, not 500', async () => {
      const bad = await request(app).post('/auth/login').set('X-Forwarded-For', freshIp()).set('Content-Type', 'application/json').send('{"email": ');
      expect(bad.status).toBe(400);
      expect(bad.body).toEqual({ error: 'Malformed request body' });
      const big = await request(app).post('/auth/login').set('X-Forwarded-For', freshIp()).set('Content-Type', 'application/json').send(JSON.stringify({ email: 'a'.repeat(200_000) }));
      expect(big.status).toBe(413);
    });

    it('rejects type confusion and injection-shaped credentials before they reach the database', async () => {
      const res = await anonymous.post('/auth/login', { email: { $ne: null }, password: ['x'] });
      expect(res.status).toBe(400);
      expect(res.body.details.map((d: any) => d.field).sort()).toEqual(['email', 'password']);
      const sql = await anonymous.post('/auth/login', { email: "' OR 1=1 --", password: 'x' });
      expect([400, 401]).toContain(sql.status);
    });

    it('rejects ids that overflow a 32-bit integer', async () => {
      await manager.login(email('manager'), password);
      expect((await manager.get('/sessions/99999999999')).status).toBe(400);
    });

    it('rate-limits repeated logins from one address (429) while other addresses stay unaffected', async () => {
      const noisy = new Client(app);
      const statuses: number[] = [];
      for (let i = 0; i < 22; i++) statuses.push((await noisy.login(email('nobody'), 'wrong-password')).status);
      expect(statuses).toContain(429);
      expect((await new Client(app).login(email('manager'), password)).status).toBe(200);
    });
  });

  describe('accounts', () => {
    it('signup stores a lower-cased email, creates a pending user, audits it and notifies managers', async () => {
      mockSendMail.mockClear();
      const res = await anonymous.post('/auth/signup', { firstname: 'Sally', lastname: 'Sales', email: `  ${email('sales').toUpperCase()} `, password, role: 'Sales', status: 'approved', role_id: 4 });
      ok(res, 201);
      ids.sales = res.body.user.id;
      const row = await prismaClient.users.findUniqueOrThrow({ where: { id: ids.sales } });
      expect(row.email).toBe(email('sales'));
      expect(row.status).toBe('pending');
      expect(row.role_id).not.toBe(4);
      const audit = await admin.query(`SELECT count(*)::int AS n FROM audit_log WHERE entity_type = 'User' AND entity_id = $1 AND action = 'create'`, [ids.sales]);
      expect(audit.rows[0].n).toBe(1);
      await new Promise((resolve) => setTimeout(resolve, 200));
      expect(mockSendMail).toHaveBeenCalledWith(expect.objectContaining({ to: expect.stringContaining(email('manager')) }));
    });

    it('rejects the same email in another letter case with a friendly message', async () => {
      const res = await anonymous.post('/auth/signup', { firstname: 'Sally', lastname: 'Again', email: email('sales').replace('e2e', 'E2E'), password, role: 'Sales' });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('An account with this email already exists');
    });

    it('will not log a pending account in, then a Manager approves it and it can log in (any email case)', async () => {
      expect((await sales.login(email('sales'), password)).status).toBe(401);
      ok(await manager.login(email('manager').toUpperCase(), password), 200);
      ok(await manager.post(`/auth/users/${ids.sales}/approve`), 200);
      const login = await sales.login(email('sales').toUpperCase(), password);
      ok(login, 200);
      const cookies = login.headers['set-cookie'] as unknown as string[];
      expect(cookies.find((c) => c.startsWith('accessToken='))).toMatch(/HttpOnly/i);
      const me = await sales.get('/auth/me');
      expect(me.body.user.email).toBe(email('sales'));
    });

    it('does not mangle passwords: a password with HTML-ish characters and spaces round-trips through change-password and login', async () => {
      const tricky = '  <Tr1cky> P@ss w0rd!  ';
      const changed = await sales.patch('/auth/me/password', { currentPassword: password, newPassword: tricky });
      ok(changed, 200);
      const again = new Client(app);
      ok(await again.login(email('sales'), tricky), 200);
      const restore = await again.patch('/auth/me/password', { currentPassword: tricky, newPassword: password });
      ok(restore, 200);
      ok(await sales.login(email('sales'), password), 200);
    });

    it('cookie sessions require the CSRF header on state-changing requests', async () => {
      const withoutHeader = new Client(app);
      await withoutHeader.login(email('sales'), password);
      withoutHeader.csrf = '';
      const res = await withoutHeader.post('/providers', { name: `${marker}-csrf` });
      expect(res.status).toBe(403);
      const wrong = new Client(app);
      await wrong.login(email('sales'), password);
      wrong.csrf = 'not-the-cookie-value';
      expect((await wrong.post('/providers', { name: `${marker}-csrf2` })).status).toBe(403);
    });
  });

  describe('catalog and sessions', () => {
    it('validates provider input at the edge and drops fields the client must not set', async () => {
      expect((await sales.post('/providers', { name: 12345 })).status).toBe(400);
      expect((await sales.post('/providers', { name: 'x'.repeat(151) })).status).toBe(400);
      expect((await sales.post('/providers', { name: 'ok', logoUrl: 'u'.repeat(501) })).status).toBe(400);
      const res = await sales.post('/providers', { name: `${marker}-provider`, description: '<b>Bold</b><script>alert(1)</script>plain', created_by: ids.manager, deleted_at: '2020-01-01' });
      ok(res, 201);
      ids.provider = res.body.id;
      const row = await prismaClient.providers.findUniqueOrThrow({ where: { id: ids.provider } });
      expect(row.created_by).toBe(ids.sales);
      expect(row.deleted_at).toBeNull();
      expect(row.description).not.toMatch(/script|<b>/i);
      expect(row.description).toContain('plain');
    });

    it('rejects a duplicate active provider name with a clear message', async () => {
      const res = await sales.post('/providers', { name: `${marker}-provider` });
      expect(res.status).toBe(400);
      expect(res.body.error).not.toMatch(/prisma|invocation|constraint failed/i);
    });

    it('creates trainings (duration 0 is allowed) and clients, and rejects negative durations and bad country codes', async () => {
      const t1 = await sales.post('/trainings', { name: `${marker}-training-1`, providerId: ids.provider, duration: 3, durationUnit: 'days' });
      ok(t1, 201);
      ids.training = t1.body.id;
      const t2 = await sales.post('/trainings', { name: `${marker}-training-2`, providerId: String(ids.provider), duration: 0, durationUnit: 'hours' });
      ok(t2, 201);
      ids.training2 = t2.body.id;
      expect((await sales.post('/trainings', { name: `${marker}-neg`, providerId: ids.provider, duration: -1, durationUnit: 'days' })).status).toBe(400);
      const c = await sales.post('/clients', { companyName: `${marker}-client`, email: 'contact@client.example.test', country: 'FR' });
      ok(c, 201);
      ids.client = c.body.id;
      expect((await sales.post('/clients', { companyName: 'x', country: 'FRA' })).status).toBe(400);
    });

    it('creates a session and its calendar entry, and rejects a second session for the same training and instant', async () => {
      const body = { trainingId: ids.training, clientId: ids.client, startDate: '2041-03-10T09:00:00Z', endDate: '2041-03-12T17:00:00Z' };
      const res = await sales.post('/sessions', body);
      ok(res, 201);
      ids.session = res.body.id;
      const calendar = await prismaClient.calendar.count({ where: { session_id: ids.session } });
      expect(calendar).toBe(1);
      const dup = await sales.post('/sessions', body);
      expect(dup.status).toBe(400);
      expect(dup.body.error).toBe('Another session for this training already starts at the exact same time');
      expect((await sales.post('/sessions', { ...body, trainingId: ids.training2, endDate: '2041-03-09T09:00:00Z' })).status).toBe(400);
      const second = await sales.post('/sessions', { ...body, trainingId: ids.training2 });
      ok(second, 201);
      ids.session2 = second.body.id;
    });

    it('registers attendees; an email is unique per session in any case, and concurrent duplicates cannot both succeed', async () => {
      const first = await sales.post(`/sessions/${ids.session}/attendees`, { name: 'Alice', email: `${marker}-alice@example.test` });
      ok(first, 201);
      ids.attendee = first.body.id;
      const dup = await sales.post(`/sessions/${ids.session}/attendees`, { name: 'Alice Again', email: `${marker.toUpperCase()}-ALICE@EXAMPLE.TEST` });
      expect(dup.status).toBe(400);
      expect(dup.body.error).toBe('This email is already registered in this session');
      ok(await sales.post(`/sessions/${ids.session}/attendees`, { name: 'No Email' }), 201);
      ok(await sales.post(`/sessions/${ids.session}/attendees`, { name: 'Blank Email', email: '' }), 201);

      const race = await Promise.all([1, 2, 3].map(() => sales.post(`/sessions/${ids.session}/attendees`, { name: 'Racer', email: `${marker}-racer@example.test` })));
      const created = race.filter((r) => r.status === 201).length;
      expect(created).toBe(1);
      for (const loser of race.filter((r) => r.status !== 201)) {
        expect(loser.status).toBe(400);
        expect(loser.body.error).toBe('This email is already registered in this session');
      }
      const rows = await prismaClient.session_attendees.count({ where: { session_id: ids.session, email: `${marker}-racer@example.test` } });
      expect(rows).toBe(1);
    });

    it('assigns a qualified instructor once per start time; the same instant elsewhere is refused', async () => {
      await prismaClient.instructor_skills.createMany({ data: [{ instructor_id: ids.instructor, training_id: ids.training }, { instructor_id: ids.instructor, training_id: ids.training2 }] });
      ok(await sales.post(`/sessions/${ids.session}/assign-instructor`, { instructorId: ids.instructor }), 403);
      const assigned = await manager.post(`/sessions/${ids.session}/assign-instructor`, { instructorId: ids.instructor });
      ok(assigned, 200);
      expect(assigned.body.assignmentStatus).toBe('accepted');
      ok(await manager.post(`/sessions/${ids.session2}/attendees`, { name: 'Second Session Attendee' }), 201);
      const conflict = await manager.post(`/sessions/${ids.session2}/assign-instructor`, { instructorId: ids.instructor });
      expect(conflict.status).toBe(400);
      expect(conflict.body.error).toBe('This instructor is already engaged in another session at that exact start time');
    });

    it('collects one survey per attendee through the public endpoint and validates the scores', async () => {
      expect((await anonymous.post(`/survey/${ids.session}/submit`, { attendeeId: ids.attendee, instructorScore: 5.5, npsScore: 9 })).status).toBe(400);
      const bad = await anonymous.post(`/survey/${ids.session}/submit`, { attendeeId: ids.attendee, instructorScore: 9, npsScore: 11 });
      expect(bad.status).toBe(400);
      ok(await anonymous.post(`/survey/${ids.session}/submit`, { attendeeId: ids.attendee, instructorScore: 5, npsScore: 9, comments: 'Great <i>session</i>' }), 201);
      const again = await anonymous.post(`/survey/${ids.session}/submit`, { attendeeId: ids.attendee, instructorScore: 4, npsScore: 8 });
      expect(again.status).toBe(400);
      expect(await prismaClient.surveys.count({ where: { attendee_id: ids.attendee } })).toBe(1);
    });
  });

  describe('announcements (relational target roles) and messaging', () => {
    it('a Developer announces to Sales; Sales sees it until rated; the junction table mirrors the request', async () => {
      ok(await developer.login(email('developer'), password, '/auth/developer-login'), 200);
      const created = await developer.post('/announcements', { title: `${marker} feature`, description: 'New thing', targetRoles: ['Sales', 'Sales', 'Manager'] });
      ok(created, 201);
      ids.announcement = created.body.id;
      const junction = await admin.query(`SELECT ro.name FROM feature_announcement_target_roles tr JOIN roles ro ON ro.id = tr.role_id WHERE tr.announcement_id = $1 ORDER BY ro.name`, [ids.announcement]);
      expect(junction.rows.map((r) => r.name)).toEqual(['Manager', 'Sales']);
      expect((await developer.post('/announcements', { title: 'x', description: 'y', targetRoles: ['Wizard'] })).status).toBe(400);

      const mine = await sales.get('/announcements/mine');
      ok(mine, 200);
      expect(mine.body.map((a: any) => a.id)).toContain(ids.announcement);
      ok(await sales.patch(`/announcements/${ids.announcement}/rate`, { stars: 5 }), 200);
      expect((await sales.get('/announcements/mine')).body.map((a: any) => a.id)).not.toContain(ids.announcement);
      const list = await developer.get('/announcements');
      const summary = list.body.find((a: any) => a.id === ids.announcement);
      expect(summary.targetRoles.sort()).toEqual(['Manager', 'Sales']);
      expect(summary.byRole).toEqual([{ role: 'Sales', averageStars: 5, ratingCount: 1 }]);
    });

    it('a Manager and an Instructor converse; a reply cannot point into another conversation; input is bounded', async () => {
      const instructor = new Client(app);
      ok(await instructor.login(email('instructor'), password), 200);
      const conversation = await manager.post('/messaging/conversations/direct', { targetUserId: ids.instructorUser });
      ok(conversation, 201);
      ids.conversation = conversation.body.id;
      const first = await manager.post(`/messaging/conversations/${ids.conversation}/messages`, { type: 'text', body: 'Hello <b>there</b>' });
      ok(first, 201);
      const reply = await instructor.post(`/messaging/conversations/${ids.conversation}/messages`, { type: 'text', body: 'Hi back', replyToMessageId: first.body.id });
      ok(reply, 201);
      const listing = await instructor.get(`/messaging/conversations/${ids.conversation}/messages?limit=10`);
      ok(listing, 200);
      expect(JSON.stringify(listing.body)).toContain('Hi back');
      expect(JSON.stringify(listing.body)).not.toContain('<b>');
      expect((await instructor.get(`/messaging/conversations/${ids.conversation}/messages?limit=abc`)).status).toBe(400);
      expect((await manager.post(`/messaging/conversations/${ids.conversation}/messages`, { type: 'text', body: 'x'.repeat(20001) })).status).toBe(400);
      ok(await instructor.post(`/messaging/conversations/${ids.conversation}/read`, { messageId: reply.body.id }), 200);

      const other = await manager.post('/messaging/conversations/direct', { targetUserId: ids.instructor2User });
      ok(other, 201);
      const crossReply = await manager.post(`/messaging/conversations/${other.body.id}/messages`, { type: 'text', body: 'cross', replyToMessageId: first.body.id });
      expect(crossReply.status).toBe(400);
      expect(crossReply.body.error).not.toMatch(/prisma|invocation|constraint/i);
      expect(await prismaClient.messages.count({ where: { conversation_id: other.body.id } })).toBe(0);
    });
  });

  describe('audit trail and least privilege', () => {
    it('records the activity, filters it, and rejects malformed filters', async () => {
      const log = await manager.get(`/admin/audit-log?entityType=Provider&entityId=${ids.provider}`);
      ok(log, 200);
      expect(Array.isArray(log.body)).toBe(true);
      expect((await manager.get('/admin/audit-log?entityId=abc')).status).toBe(400);
    });

    it('the application role cannot rewrite or delete history (skipped when connected as owner/superuser)', async () => {
      const who = await pool.query(`SELECT rolsuper, (SELECT pg_get_userbyid(relowner) = current_user FROM pg_class WHERE relname = 'audit_log') AS owns FROM pg_roles WHERE rolname = current_user`);
      if (who.rows[0].rolsuper || who.rows[0].owns) return;
      await expect(pool.query(`DELETE FROM audit_log WHERE actor_id = $1`, [ids.sales])).rejects.toMatchObject({ code: '42501' });
      await expect(pool.query(`UPDATE audit_log SET action = 'forged' WHERE actor_id = $1`, [ids.sales])).rejects.toMatchObject({ code: '42501' });
    });
  });

  describe('hostile input', () => {
    it('stores injection-shaped and prototype-polluting input as inert data', async () => {
      const name = `${marker}-Robert'); DROP TABLE users;--`;
      const res = await sales.post('/providers', { name });
      ok(res, 201);
      expect(await prismaClient.users.count()).toBeGreaterThan(0);
      const polluted = await request(app)
        .post('/providers')
        .set('X-Forwarded-For', freshIp())
        .set('Cookie', sales.cookie)
        .set('X-CSRF-Token', sales.csrf)
        .set('Content-Type', 'application/json')
        .send(`{"name":"${marker}-proto","__proto__":{"polluted":true},"constructor":{"prototype":{"polluted":true}}}`);
      ok(polluted, 201);
      expect(({} as any).polluted).toBeUndefined();
    });

    it('unauthenticated callers get 401 (not a validation error) on protected routes', async () => {
      const res = await anonymous.post('/providers', { name: 12345 });
      expect(res.status).toBe(401);
    });
  });
});
