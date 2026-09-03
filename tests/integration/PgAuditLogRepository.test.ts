


import { PgAuditLogRepository } from '../../src/infrastructure/repositories/PgAuditLogRepository';
import { prismaClient } from '../../src/infrastructure/database/prismaClient';

describe('PgAuditLogRepository (Prisma, real database)', () => {
  const repository = new PgAuditLogRepository(prismaClient);
  const marker = `audit-log-test-${Date.now()}`;
  let testUserId: number;
  let testUserRoleName: string;

  beforeAll(async () => {
    const role = await prismaClient.roles.findFirstOrThrow();
    testUserRoleName = role.name;
    const user = await prismaClient.users.create({
      data: {
        firstname: 'Audit',
        lastname: 'Tester',
        email: `${marker}@example.com`,
        password_hash: 'not-a-real-hash',
        role_id: role.id,
      },
    });
    testUserId = user.id;
  });

  afterAll(async () => {
    await prismaClient.audit_log.deleteMany({ where: { entity_type: marker } });
    await prismaClient.users.delete({ where: { id: testUserId } });
    await prismaClient.$disconnect();
  });

  it('creates an entry and lists it back with the actor name joined in', async () => {
    const created = await repository.create({
      actorId: testUserId,
      action: 'create',
      entityType: marker,
      entityId: 1,
      before: null,
      after: { name: 'test' },
    });

    expect(created.actorId).toBe(testUserId);
    expect(created.after).toEqual({ name: 'test' });

    const results = await repository.list({ entityType: marker });

    expect(results).toHaveLength(1);
    expect(results[0].actorName).toBe('Audit Tester');
    expect(results[0].entityId).toBe(1);
  });

  it('combines entityType and excludeEntityTypes as AND, not one overwriting the other', async () => {
    
    
    
    await repository.create({ actorId: testUserId, action: 'create', entityType: marker, entityId: 2 });
    await repository.create({ actorId: testUserId, action: 'create', entityType: 'User', entityId: 99 });

    const matching = await repository.list({ entityType: marker, excludeEntityTypes: ['User'] });
    expect(matching.every((r) => r.entityType === marker)).toBe(true);

    const excluded = await repository.list({ entityType: 'User', excludeEntityTypes: ['User'] });
    expect(excluded).toHaveLength(0);

    await prismaClient.audit_log.deleteMany({ where: { entity_type: 'User', actor_id: testUserId } });
  });

  it('filters by roleName via the actor\'s role', async () => {
    await repository.create({ actorId: testUserId, action: 'create', entityType: marker, entityId: 3 });

    const matching = await repository.list({ entityType: marker, roleName: testUserRoleName });
    expect(matching.some((r) => r.entityId === 3)).toBe(true);

    const nonMatchingRole = testUserRoleName === 'SuperAdmin' ? 'Sales' : 'SuperAdmin';
    const nonMatching = await repository.list({ entityType: marker, roleName: nonMatchingRole });
    expect(nonMatching.some((r) => r.entityId === 3)).toBe(false);
  });

  it('filters by a created_at date range', async () => {
    const created = await repository.create({ actorId: testUserId, action: 'create', entityType: marker, entityId: 4 });
    const createdAt = new Date(created.createdAt);

    const within = await repository.list({
      entityType: marker,
      startDate: new Date(createdAt.getTime() - 60000).toISOString(),
      endDate: new Date(createdAt.getTime() + 60000).toISOString(),
    });
    expect(within.some((r) => r.entityId === 4)).toBe(true);

    const before = await repository.list({
      entityType: marker,
      endDate: new Date(createdAt.getTime() - 60000).toISOString(),
    });
    expect(before.some((r) => r.entityId === 4)).toBe(false);

    const after = await repository.list({
      entityType: marker,
      startDate: new Date(createdAt.getTime() + 60000).toISOString(),
    });
    expect(after.some((r) => r.entityId === 4)).toBe(false);
  });

  it('redactUserEntries flags actor rows as actor_deleted and scrubs name/email from User-entity snapshots', async () => {
    const actedOnByThemselves = await repository.create({
      actorId: testUserId,
      action: 'create',
      entityType: 'User',
      entityId: testUserId,
      before: null,
      after: { id: testUserId, firstname: 'Audit', lastname: 'Tester', email: 'audit@example.com', status: 'pending' },
    });
    const actedByThemOnSomethingElse = await repository.create({
      actorId: testUserId,
      action: 'create',
      entityType: marker,
      entityId: 5,
    });

    await repository.redactUserEntries(testUserId);

    const own = await prismaClient.audit_log.findUniqueOrThrow({ where: { id: actedOnByThemselves.id } });
    expect(own.after).toEqual({ id: testUserId, firstname: '[deleted]', lastname: '[deleted]', email: '[deleted]', status: 'pending' });
    expect(own.actor_deleted).toBe(true);

    const other = await prismaClient.audit_log.findUniqueOrThrow({ where: { id: actedByThemOnSomethingElse.id } });
    expect(other.actor_deleted).toBe(true);

    await prismaClient.audit_log.deleteMany({ where: { entity_type: 'User', entity_id: testUserId } });
  });
});
