import { AuditLogEntry } from '../../domain/entities/AuditLogEntry';
import { IAuditLogRepository } from '../../domain/interfaces/IAuditLogRepository';

const REDACTED_USER_FIELDS = ['firstname', 'lastname', 'email'];
const REDACTED = '[deleted]';





function redactUserFields(snapshot) {
  if (!snapshot || typeof snapshot !== 'object') return snapshot;
  const redacted = { ...snapshot };
  for (const field of REDACTED_USER_FIELDS) {
    if (field in redacted) redacted[field] = REDACTED;
  }
  return redacted;
}

function mapRow(row) {
  if (!row) return null;
  return new AuditLogEntry({
    id: row.id,
    actorId: row.actor_id,
    actorName: row.actor_name,
    actorDeleted: row.actor_deleted,
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

  async list({ entityType, entityId, excludeEntityTypes, startDate, endDate, roleName }: any = {}) {
    const entityTypeFilter: any = {};
    if (entityType) entityTypeFilter.equals = entityType;
    if (excludeEntityTypes && excludeEntityTypes.length > 0) entityTypeFilter.notIn = excludeEntityTypes;

    const createdAtFilter: any = {};
    if (startDate) createdAtFilter.gte = new Date(startDate);
    if (endDate) createdAtFilter.lte = new Date(endDate);

    const rows = await this.prisma.audit_log.findMany({
      where: {
        ...(Object.keys(entityTypeFilter).length > 0 ? { entity_type: entityTypeFilter } : {}),
        ...(entityId !== undefined ? { entity_id: entityId } : {}),
        ...(Object.keys(createdAtFilter).length > 0 ? { created_at: createdAtFilter } : {}),
        ...(roleName ? { users: { roles: { name: roleName } } } : {}),
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

  
  
  
  
  
  
  
  
  
  
  async redactUserEntries(userId) {
    await this.prisma.audit_log.updateMany({
      where: { actor_id: userId },
      data: { actor_deleted: true },
    });

    const userEntries = await this.prisma.audit_log.findMany({
      where: { entity_type: 'User', entity_id: userId },
    });

    for (const entry of userEntries) {
      await this.prisma.audit_log.update({
        where: { id: entry.id },
        data: {
          before: redactUserFields(entry.before),
          after: redactUserFields(entry.after),
        },
      });
    }
  }
}

export { PgAuditLogRepository };
