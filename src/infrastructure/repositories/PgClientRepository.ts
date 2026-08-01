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
    createdAt: row.created_at,
  });
}

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
       RETURNING *`,
      [client.companyName, client.email, client.phone, client.createdBy]
    );
    return mapRow(rows[0]);
  }

  async findById(id) {
    const { rows } = await this.pool.query(
      'SELECT * FROM clients WHERE id = $1 AND deleted_at IS NULL',
      [id]
    );
    return mapRow(rows[0]);
  }

  async listAll() {
    const { rows } = await this.pool.query(
      'SELECT * FROM clients WHERE deleted_at IS NULL ORDER BY created_at DESC'
    );
    return rows.map(mapRow);
  }
}

export { PgClientRepository };
