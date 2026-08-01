import { AuditLogEntry } from '../../domain/entities/AuditLogEntry';
import { IAuditLogRepository } from '../../domain/interfaces/IAuditLogRepository';

function mapRow(row) {
  if (!row) return null;
  return new AuditLogEntry({
    id: row.id,
    actorId: row.actor_id,
    action: row.action,
    entityType: row.entity_type,
    entityId: row.entity_id,
    before: row.before,
    after: row.after,
    createdAt: row.created_at,
  });
}

class PgAuditLogRepository extends IAuditLogRepository {
  pool: any;

  constructor(pool) {
    super();
    this.pool = pool;
  }

  async create({ actorId, action, entityType, entityId, before = null, after = null }) {
    const { rows } = await this.pool.query(
      `INSERT INTO audit_log (actor_id, action, entity_type, entity_id, before, after)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        actorId,
        action,
        entityType,
        entityId,
        before ? JSON.stringify(before) : null,
        after ? JSON.stringify(after) : null,
      ]
    );
    return mapRow(rows[0]);
  }
}

export { PgAuditLogRepository };
