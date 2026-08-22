import { AuditLogEntry } from '../../domain/entities/AuditLogEntry';
import { IAuditLogRepository } from '../../domain/interfaces/IAuditLogRepository';

function mapRow(row) {
  if (!row) return null;
  return new AuditLogEntry({
    id: row.id,
    actorId: row.actor_id,
    actorName: row.actor_name,
    action: row.action,
    entityType: row.entity_type,
    entityId: row.entity_id,
    before: row.before,
    after: row.after,
    createdAt: row.created_at,
  });
}

class PgAuditLogRepository extends IAuditLogRepository {
  prisma: any;

  constructor(prisma) {
    super();
    this.prisma = prisma;
  }

  async create({ actorId, action, entityType, entityId, before = null, after = null }) {
    const row = await this.prisma.audit_log.create({
      data: {
        actor_id: actorId,
        action,
        entity_type: entityType,
        entity_id: entityId,
        before: before ? before : null,
        after: after ? after : null,
      },
    });
    return mapRow(row);
  }

  async list({ entityType, entityId, excludeEntityTypes }: any = {}) {
    
    
    
    
    
    const entityTypeFilter: any = {};
    if (entityType) entityTypeFilter.equals = entityType;
    if (excludeEntityTypes && excludeEntityTypes.length > 0) entityTypeFilter.notIn = excludeEntityTypes;

    const rows = await this.prisma.audit_log.findMany({
      where: {
        ...(Object.keys(entityTypeFilter).length > 0 ? { entity_type: entityTypeFilter } : {}),
        ...(entityId !== undefined ? { entity_id: entityId } : {}),
      },
      include: { users: { select: { firstname: true, lastname: true } } },
      orderBy: { created_at: 'desc' },
      take: 200,
    });

    return rows.map((row) =>
      mapRow({
        ...row,
        actor_name: row.users ? `${row.users.firstname} ${row.users.lastname}` : null,
      })
    );
  }
}

export { PgAuditLogRepository };
