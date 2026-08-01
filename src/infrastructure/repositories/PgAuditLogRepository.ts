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

  async list({ entityType, entityId, excludeEntityTypes }: any = {}) {
    const conditions = [];
    const params = [];
    let i = 1;

    if (entityType) {
      conditions.push(`entity_type = $${i++}`);
      params.push(entityType);
    }
    if (entityId !== undefined) {
      conditions.push(`entity_id = $${i++}`);
      params.push(entityId);
    }
    if (excludeEntityTypes && excludeEntityTypes.length > 0) {
      conditions.push(`entity_type NOT IN (${excludeEntityTypes.map(() => `$${i++}`).join(', ')})`);
      params.push(...excludeEntityTypes);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const { rows } = await this.pool.query(
      `SELECT * FROM audit_log ${where} ORDER BY created_at DESC LIMIT 200`,
      params
    );
    return rows.map(mapRow);
  }
}

export { PgAuditLogRepository };
