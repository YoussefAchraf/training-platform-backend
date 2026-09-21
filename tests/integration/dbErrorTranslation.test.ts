import { prismaClient } from '../../src/infrastructure/database/prismaClient';

const LEAK = /invocation|prismaClient\.|prisma\.|\/app\/|Failing row|password_hash|does_not_exist/i;

describe('database errors surfaced through the Prisma client are safe and friendly (real database)', () => {
  const marker = `dberr${Date.now()}`;
  let roleId: number;
  const base = () => ({ firstname: 'E', lastname: 'S', password_hash: 'x', role_id: roleId });

  beforeAll(async () => {
    roleId = (await prismaClient.roles.findFirstOrThrow()).id;
    await prismaClient.users.create({ data: { ...base(), email: `${marker}@example.test` } });
  });

  afterAll(async () => {
    await prismaClient.users.deleteMany({ where: { email: { startsWith: marker } } });
    await prismaClient.users.deleteMany({ where: { email: { startsWith: marker.toUpperCase() } } });
    await prismaClient.$disconnect();
  });

  async function messageOf(fn: () => Promise<unknown>) {
    try {
      await fn();
    } catch (err) {
      return err.message as string;
    }
    throw new Error('expected the operation to fail');
  }

  it('unique violation on the case-insensitive email index', async () => {
    const message = await messageOf(() => prismaClient.users.create({ data: { ...base(), email: `${marker.toUpperCase()}@EXAMPLE.TEST` } }));
    expect(message).toBe('An account with this email already exists');
  });

  it('check violation never echoes the failing row (which contains the password hash)', async () => {
    const message = await messageOf(() => prismaClient.users.create({ data: { ...base(), firstname: '   ', email: `${marker}-b@example.test` } }));
    expect(message).toBe('First name and last name must not be blank');
    expect(message).not.toMatch(LEAK);
  });

  it('foreign key violation', async () => {
    const message = await messageOf(() => prismaClient.users.create({ data: { ...base(), role_id: 999999, email: `${marker}-c@example.test` } }));
    expect(message).toBe('The referenced record does not exist, or this record is still in use');
  });

  it('value too long', async () => {
    const message = await messageOf(() => prismaClient.users.create({ data: { ...base(), firstname: 'x'.repeat(500), email: `${marker}-d@example.test` } }));
    expect(message).toBe('A value is longer than allowed');
  });

  it('a missing record on findUniqueOrThrow', async () => {
    const message = await messageOf(() => prismaClient.users.findUniqueOrThrow({ where: { id: 2147483000 } }));
    expect(message).not.toMatch(LEAK);
  });

  it('raw queries are covered too and never reveal schema details', async () => {
    const message = await messageOf(() => prismaClient.$queryRaw`SELECT * FROM does_not_exist`);
    expect(message).toBe('The request could not be processed');
    expect(message).not.toMatch(LEAK);
  });

  it('invalid arguments (Prisma validation errors) are hidden behind a generic message', async () => {
    const message = await messageOf(() => prismaClient.users.findMany({ where: { id: 'not-a-number' as unknown as number } }));
    expect(message).not.toMatch(LEAK);
  });
});
