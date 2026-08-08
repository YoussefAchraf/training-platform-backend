import { Client } from '../../domain/entities/Client';
import { IClientRepository } from '../../domain/interfaces/IClientRepository';

function mapRow(row) {
  if (!row) return null;
  return new Client({
    id: row.id,
    companyName: row.company_name,
    email: row.email,
    phone: row.phone,
    createdBy: row.created_by,
    creatorName: row.creator_name,
    createdAt: row.created_at,
  });
}




const CREATOR_NAME_RETURNING = `*, (SELECT firstname || ' ' || lastname FROM users WHERE id = created_by) AS creator_name`;

class PgClientRepository extends IClientRepository {
  pool: any;

  constructor(pool) {
    super();
    this.pool = pool;
  }

  async create(client) {
    const { rows } = await this.pool.query(
      `INSERT INTO clients (company_name, email, phone, created_by)
       VALUES ($1, $2, $3, $4)
       RETURNING ${CREATOR_NAME_RETURNING}`,
      [client.companyName, client.email, client.phone, client.createdBy]
    );
    return mapRow(rows[0]);
  }

  async findById(id) {
    const { rows } = await this.pool.query(
      `SELECT c.*, u.firstname || ' ' || u.lastname AS creator_name
       FROM clients c
       LEFT JOIN users u ON u.id = c.created_by
       WHERE c.id = $1 AND c.deleted_at IS NULL`,
      [id]
    );
    return mapRow(rows[0]);
  }

  async listAll() {
    const { rows } = await this.pool.query(
      `SELECT c.*, u.firstname || ' ' || u.lastname AS creator_name
       FROM clients c
       LEFT JOIN users u ON u.id = c.created_by
       WHERE c.deleted_at IS NULL
       ORDER BY c.created_at DESC`
    );
    return rows.map(mapRow);
  }

  async update(id, fields) {
    const { rows } = await this.pool.query(
      `UPDATE clients
       SET company_name = COALESCE($2, company_name),
           email = COALESCE($3, email),
           phone = COALESCE($4, phone),
           updated_at = now()
       WHERE id = $1 AND deleted_at IS NULL
       RETURNING ${CREATOR_NAME_RETURNING}`,
      [id, fields.companyName || null, fields.email || null, fields.phone || null]
    );
    return mapRow(rows[0]);
  }

  async softDelete(id) {
    const { rows } = await this.pool.query(
      `UPDATE clients SET deleted_at = now() WHERE id = $1 AND deleted_at IS NULL RETURNING ${CREATOR_NAME_RETURNING}`,
      [id]
    );
    return mapRow(rows[0]);
  }
}

export { PgClientRepository };
