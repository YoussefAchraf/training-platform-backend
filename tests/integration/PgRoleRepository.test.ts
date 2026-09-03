




import { PgRoleRepository } from '../../src/infrastructure/repositories/PgRoleRepository';
import { prismaClient } from '../../src/infrastructure/database/prismaClient';

describe('PgRoleRepository (Prisma, real database)', () => {
  const repository = new PgRoleRepository(prismaClient);

  afterAll(async () => {
    await prismaClient.$disconnect();
  });

  it('lists the real seeded roles, ordered by id ascending', async () => {
    const roles = await repository.listAll();

    const names = roles.map((r) => r.name);
    expect(names).toEqual(expect.arrayContaining(['Sales', 'Manager', 'Instructor', 'SuperAdmin', 'Developer']));
    expect(roles.length).toBe(5);

    const ids = roles.map((r) => r.id);
    expect(ids).toEqual([...ids].sort((a, b) => a - b));

    for (const role of roles) {
      expect(typeof role.id).toBe('number');
      expect(typeof role.name).toBe('string');
    }
  });
});
