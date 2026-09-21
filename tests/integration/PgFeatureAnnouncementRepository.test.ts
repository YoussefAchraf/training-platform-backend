import { PgFeatureAnnouncementRepository } from '../../src/infrastructure/repositories/PgFeatureAnnouncementRepository';
import { prismaClient } from '../../src/infrastructure/database/prismaClient';

describe('PgFeatureAnnouncementRepository (junction table, real database)', () => {
  const repo = new PgFeatureAnnouncementRepository(prismaClient);
  const marker = `announce-test-${Date.now()}`;
  let userId: number;
  let salesUserId: number;
  const announcementIds: number[] = [];

  async function junctionRoles(announcementId: number): Promise<string[]> {
    const rows = await prismaClient.feature_announcement_target_roles.findMany({
      where: { announcement_id: announcementId },
      include: { roles: { select: { name: true } } },
      orderBy: { role_id: 'asc' },
    });
    return rows.map((r) => r.roles.name);
  }

  beforeAll(async () => {
    const sales = await prismaClient.roles.findUniqueOrThrow({ where: { name: 'Sales' } });
    const developer = await prismaClient.roles.findUniqueOrThrow({ where: { name: 'Developer' } });
    userId = (
      await prismaClient.users.create({
        data: { firstname: 'Ann', lastname: 'Dev', email: `${marker}-dev@example.test`, password_hash: 'x', role_id: developer.id },
      })
    ).id;
    salesUserId = (
      await prismaClient.users.create({
        data: { firstname: 'Ann', lastname: 'Sales', email: `${marker}-sales@example.test`, password_hash: 'x', role_id: sales.id },
      })
    ).id;
  });

  afterAll(async () => {
    await prismaClient.feature_announcements.deleteMany({ where: { id: { in: announcementIds } } });
    await prismaClient.users.deleteMany({ where: { email: { startsWith: marker } } });
    await prismaClient.$disconnect();
  });

  it('create writes the JSON column and the junction rows, and returns the roles from the junction', async () => {
    const created = await repo.create({ createdBy: userId, title: `${marker}-a`, description: 'd', targetRoles: ['Manager', 'Sales'] });
    announcementIds.push(created.id);

    expect(await junctionRoles(created.id)).toEqual(['Sales', 'Manager']);
    expect([...created.targetRoles].sort()).toEqual(['Manager', 'Sales']);
    expect([...(await repo.findById(created.id)).targetRoles].sort()).toEqual(['Manager', 'Sales']);
  });

  it('listPendingForUser filters through the junction, excludes rated and older announcements', async () => {
    const forSales = await repo.create({ createdBy: userId, title: `${marker}-sales`, description: 'd', targetRoles: ['Sales'] });
    const forManager = await repo.create({ createdBy: userId, title: `${marker}-manager`, description: 'd', targetRoles: ['Manager'] });
    announcementIds.push(forSales.id, forManager.id);

    const joinedAt = new Date(Date.now() - 60_000);
    const pending = await repo.listPendingForUser({ userId: salesUserId, role: 'Sales', joinedAt });
    const ids = pending.map((a) => a.id);
    expect(ids).toContain(forSales.id);
    expect(ids).not.toContain(forManager.id);
    expect(pending.find((a) => a.id === forSales.id).targetRoles).toEqual(['Sales']);

    await repo.rate({ announcementId: forSales.id, userId: salesUserId, stars: 4 });
    const afterRating = await repo.listPendingForUser({ userId: salesUserId, role: 'Sales', joinedAt });
    expect(afterRating.map((a) => a.id)).not.toContain(forSales.id);

    const future = await repo.listPendingForUser({ userId: salesUserId, role: 'Sales', joinedAt: new Date(Date.now() + 3_600_000) });
    expect(future.map((a) => a.id)).not.toContain(forSales.id);
  });

  it('listAllWithRatings carries target roles and rating summaries', async () => {
    const all = await repo.listAllWithRatings();
    const rated = all.find((a) => a.title === `${marker}-sales`);
    expect(rated.targetRoles).toEqual(['Sales']);
    expect(rated.overallRatingCount).toBe(1);
    expect(rated.byRole).toEqual([{ role: 'Sales', averageStars: 4, ratingCount: 1 }]);
  });

  it('old code that writes only the JSON column still lands in the junction (sync trigger)', async () => {
    const row = await prismaClient.feature_announcements.create({
      data: { created_by: userId, title: `${marker}-legacy-writer`, description: 'd', target_roles: ['Instructor', 'SuperAdmin'] },
    });
    announcementIds.push(row.id);
    expect(await junctionRoles(row.id)).toEqual(['Instructor', 'SuperAdmin']);

    await prismaClient.feature_announcements.update({ where: { id: row.id }, data: { target_roles: ['Sales'] } });
    expect(await junctionRoles(row.id)).toEqual(['Sales']);
  });

  it('rejects unknown roles and non-array JSON with a friendly message', async () => {
    const unknown = prismaClient.feature_announcements.create({
      data: { created_by: userId, title: `${marker}-bad`, description: 'd', target_roles: ['Wizard'] },
    });
    await expect(unknown).rejects.toThrow('targetRoles contains an unknown role');

    const notArray = prismaClient.feature_announcements.create({
      data: { created_by: userId, title: `${marker}-bad2`, description: 'd', target_roles: { Sales: true } },
    });
    await expect(notArray).rejects.toThrow('targetRoles must be an array of role names');
  });

  it('deleting an announcement removes its junction rows', async () => {
    const created = await repo.create({ createdBy: userId, title: `${marker}-cascade`, description: 'd', targetRoles: ['Manager'] });
    expect(await junctionRoles(created.id)).toEqual(['Manager']);
    await prismaClient.feature_announcements.delete({ where: { id: created.id } });
    expect(await junctionRoles(created.id)).toEqual([]);
  });
});
