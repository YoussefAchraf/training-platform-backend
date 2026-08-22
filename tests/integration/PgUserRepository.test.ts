



import { PgUserRepository } from '../../src/infrastructure/repositories/PgUserRepository';
import { prismaClient } from '../../src/infrastructure/database/prismaClient';

describe('PgUserRepository (Prisma, real database)', () => {
  const repo = new PgUserRepository(prismaClient);
  const marker = `user-test-${Date.now()}`;
  let managerRoleId: number;
  let userId: number;
  let approverId: number;

  beforeAll(async () => {
    const managerRole = await prismaClient.roles.findUniqueOrThrow({ where: { name: 'Manager' } });
    managerRoleId = managerRole.id;
    const approver = await prismaClient.users.create({
      data: { firstname: 'Approver', lastname: 'Tester', email: `${marker}-approver@example.com`, password_hash: 'x', role_id: managerRoleId, status: 'approved' },
    });
    approverId = approver.id;
  });

  afterAll(async () => {
    await prismaClient.users.deleteMany({ where: { email: { startsWith: marker } } });
    await prismaClient.$disconnect();
  });

  it('create + findById/findByEmail return the joined role name', async () => {
    const user = await repo.create({
      firstname: 'New',
      lastname: 'User',
      email: `${marker}@example.com`,
      passwordHash: 'hashed',
      roleId: managerRoleId,
      status: 'pending',
    });
    userId = user.id;
    expect(user.roleName).toBe('Manager');

    const byId = await repo.findById(userId);
    expect(byId.email).toBe(`${marker}@example.com`);
    const byEmail = await repo.findByEmail(`${marker}@example.com`);
    expect(byEmail.id).toBe(userId);

    expect(await repo.findByEmail('does-not-exist@example.com')).toBeNull();
  });

  it('findRoleByName resolves a real role and null for a fake one', async () => {
    const role = await repo.findRoleByName('Manager');
    expect(role.id).toBe(managerRoleId);
    expect(await repo.findRoleByName('NotARealRole')).toBeNull();
  });

  it('listPending includes the new user, approve moves it out of listPending', async () => {
    const pending = await repo.listPending();
    expect(pending.find((u) => u.id === userId)).toBeDefined();

    const approved = await repo.approve(userId, approverId);
    expect(approved.status).toBe('approved');
    expect(approved.approvedBy).toBe(approverId);

    const pendingAfter = await repo.listPending();
    expect(pendingAfter.find((u) => u.id === userId)).toBeUndefined();

    const managers = await repo.listApprovedManagers();
    expect(managers.find((u) => u.id === userId)).toBeDefined();
  });

  it('update only applies truthy fields and returns null for a nonexistent user', async () => {
    const updated = await repo.update(userId, { firstname: 'Changed' });
    expect(updated.firstname).toBe('Changed');
    expect(updated.lastname).toBe('User');

    expect(await repo.update(999999999, { firstname: 'X' })).toBeNull();
  });

  it('reject sets status to rejected', async () => {
    const rejected = await repo.reject(userId, approverId);
    expect(rejected.status).toBe('rejected');
  });

  it('countActiveSuperAdmins reflects an approved SuperAdmin created by this test, and listAll includes it', async () => {
    
    
    
    const superAdminRole = await prismaClient.roles.findUniqueOrThrow({ where: { name: 'SuperAdmin' } });
    const before = await repo.countActiveSuperAdmins();

    const superAdmin = await repo.create({
      firstname: 'Super',
      lastname: 'Admin',
      email: `${marker}-superadmin@example.com`,
      passwordHash: 'hashed',
      roleId: superAdminRole.id,
      status: 'approved',
    });

    const after = await repo.countActiveSuperAdmins();
    expect(after).toBe(before + 1);

    const all = await repo.listAll();
    expect(all.find((u) => u.id === superAdmin.id)).toBeDefined();
    expect(all.find((u) => u.id === userId)).toBeDefined();
  });
});
