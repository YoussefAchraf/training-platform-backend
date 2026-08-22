


import { PgAuditLogRepository } from '../../src/infrastructure/repositories/PgAuditLogRepository';
import { prismaClient } from '../../src/infrastructure/database/prismaClient';

describe('PgAuditLogRepository (Prisma, real database)', () => {
  const repository = new PgAuditLogRepository(prismaClient);
  const marker = `audit-log-test-${Date.now()}`;
  let testUserId: number;

  beforeAll(async () => {
    const role = await prismaClient.roles.findFirstOrThrow();
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
});
