import { FeatureAnnouncement } from '../../domain/entities/FeatureAnnouncement';
import { IFeatureAnnouncementRepository } from '../../domain/interfaces/IFeatureAnnouncementRepository';

function mapRow(row, targetRoles?: string[]) {
  if (!row) return null;
  return new FeatureAnnouncement({
    id: row.id,
    createdBy: row.created_by,
    title: row.title,
    description: row.description,
    targetRoles: targetRoles && targetRoles.length > 0 ? targetRoles : row.target_roles,
    createdAt: row.created_at,
  });
}

class PgFeatureAnnouncementRepository extends IFeatureAnnouncementRepository {
  prisma: any;

  constructor(prisma) {
    super();
    this.prisma = prisma;
  }

  async loadTargetRoles(announcementIds: number[]): Promise<Map<number, string[]>> {
    const byAnnouncement = new Map<number, string[]>();
    if (announcementIds.length === 0) return byAnnouncement;
    const rows = await this.prisma.feature_announcement_target_roles.findMany({
      where: { announcement_id: { in: announcementIds } },
      include: { roles: { select: { name: true } } },
      orderBy: [{ announcement_id: 'asc' }, { role_id: 'asc' }],
    });
    for (const row of rows) {
      const names = byAnnouncement.get(row.announcement_id) ?? [];
      names.push(row.roles.name);
      byAnnouncement.set(row.announcement_id, names);
    }
    return byAnnouncement;
  }

  async create({ createdBy, title, description, targetRoles }) {
    const row = await this.prisma.feature_announcements.create({
      data: {
        created_by: createdBy,
        title,
        description,
        target_roles: targetRoles,
      },
    });
    const roles = await this.loadTargetRoles([row.id]);
    return mapRow(row, roles.get(row.id));
  }

  async findById(id) {
    const row = await this.prisma.feature_announcements.findUnique({ where: { id } });
    if (!row) return null;
    const roles = await this.loadTargetRoles([row.id]);
    return mapRow(row, roles.get(row.id));
  }

  
  
  
  
  
  async listAllWithRatings() {
    const announcements = await this.prisma.feature_announcements.findMany({
      orderBy: { created_at: 'desc' },
    });
    if (announcements.length === 0) return [];

    const byRole = await this.prisma.$queryRaw<any[]>`
      SELECT
        r.announcement_id,
        ro.name AS role_name,
        AVG(r.stars)::numeric(3,2) AS avg_stars,
        COUNT(*)::int AS rating_count
      FROM feature_announcement_ratings r
      JOIN users u ON u.id = r.user_id
      JOIN roles ro ON ro.id = u.role_id
      GROUP BY r.announcement_id, ro.name
    `;

    const overall = await this.prisma.$queryRaw<any[]>`
      SELECT
        announcement_id,
        AVG(stars)::numeric(3,2) AS avg_stars,
        COUNT(*)::int AS rating_count
      FROM feature_announcement_ratings
      GROUP BY announcement_id
    `;

    const overallByAnnouncement = new Map<number, any>(overall.map((row) => [row.announcement_id, row]));
    const roleRowsByAnnouncement = new Map<number, any[]>();
    for (const row of byRole) {
      const list = roleRowsByAnnouncement.get(row.announcement_id) ?? [];
      list.push(row);
      roleRowsByAnnouncement.set(row.announcement_id, list);
    }

    const targetRolesByAnnouncement = await this.loadTargetRoles(announcements.map((row) => row.id));

    return announcements.map((row) => {
      const overallRow = overallByAnnouncement.get(row.id);
      const roleRows = roleRowsByAnnouncement.get(row.id) ?? [];
      return {
        ...mapRow(row, targetRolesByAnnouncement.get(row.id)),
        overallAverageStars: overallRow ? Number(overallRow.avg_stars) : null,
        overallRatingCount: overallRow ? overallRow.rating_count : 0,
        byRole: roleRows.map((r) => ({
          role: r.role_name,
          averageStars: Number(r.avg_stars),
          ratingCount: r.rating_count,
        })),
      };
    });
  }

  async listPendingForUser({ userId, role, joinedAt }) {
    const rows = await this.prisma.$queryRaw<any[]>`
      SELECT a.*
      FROM feature_announcements a
      WHERE EXISTS (
          SELECT 1 FROM feature_announcement_target_roles tr
          JOIN roles ro ON ro.id = tr.role_id
          WHERE tr.announcement_id = a.id AND ro.name = ${role}
        )
        AND a.created_at >= ${joinedAt}
        AND NOT EXISTS (
          SELECT 1 FROM feature_announcement_ratings r
          WHERE r.announcement_id = a.id AND r.user_id = ${userId}
        )
      ORDER BY a.created_at ASC
    `;
    const targetRolesByAnnouncement = await this.loadTargetRoles(rows.map((row) => row.id));
    return rows.map((row) => mapRow(row, targetRolesByAnnouncement.get(row.id)));
  }

  async rate({ announcementId, userId, stars }) {
    await this.prisma.feature_announcement_ratings.upsert({
      where: { announcement_id_user_id: { announcement_id: announcementId, user_id: userId } },
      create: { announcement_id: announcementId, user_id: userId, stars },
      update: { stars },
    });
  }
}

export { PgFeatureAnnouncementRepository };
