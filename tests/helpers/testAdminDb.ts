import { Pool } from 'pg';

let adminPool: Pool | null = null;

function getAdminPool(): Pool {
  if (!adminPool) {
    const connectionString =
      process.env.TEST_ADMIN_DATABASE_URL || process.env.MIGRATOR_DATABASE_URL || process.env.DATABASE_URL;
    adminPool = new Pool({ connectionString, max: 1 });
  }
  return adminPool;
}

export async function deleteAuditLogs(filter: { entityType?: string; actorId?: number; entityId?: number }): Promise<void> {
  const clauses: string[] = [];
  const params: unknown[] = [];
  if (filter.entityType !== undefined) {
    params.push(filter.entityType);
    clauses.push(`entity_type = $${params.length}`);
  }
  if (filter.actorId !== undefined) {
    params.push(filter.actorId);
    clauses.push(`actor_id = $${params.length}`);
  }
  if (filter.entityId !== undefined) {
    params.push(filter.entityId);
    clauses.push(`entity_id = $${params.length}`);
  }
  if (clauses.length === 0) {
    throw new Error('deleteAuditLogs requires at least one filter; refusing to delete every audit row.');
  }
  await getAdminPool().query(`DELETE FROM audit_log WHERE ${clauses.join(' AND ')}`, params);
}

export async function closeTestAdminDb(): Promise<void> {
  if (adminPool) {
    await adminPool.end();
    adminPool = null;
  }
}
