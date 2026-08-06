import { Provider } from '../../domain/entities/Provider';
import { IProviderRepository } from '../../domain/interfaces/IProviderRepository';

function mapRow(row) {
  if (!row) return null;
  return new Provider({
    id: row.id,
    name: row.name,
    description: row.description,
    logoUrl: row.logo_url,
    createdBy: row.created_by,
    creatorName: row.creator_name,
    createdAt: row.created_at,
  });
}




const CREATOR_NAME_RETURNING = `*, (SELECT firstname || ' ' || lastname FROM users WHERE id = created_by) AS creator_name`;

class PgProviderRepository extends IProviderRepository {
  pool: any;

  constructor(pool) {
    super();
    this.pool = pool;
  }

  async create(provider) {
    const { rows } = await this.pool.query(
      `INSERT INTO providers (name, description, logo_url, created_by) VALUES ($1, $2, $3, $4) RETURNING ${CREATOR_NAME_RETURNING}`,
      [provider.name, provider.description, provider.logoUrl || null, provider.createdBy]
    );
    return mapRow(rows[0]);
  }

  async update(id, fields) {
    const { rows } = await this.pool.query(
      `UPDATE providers
       SET name = COALESCE($2, name),
           description = COALESCE($3, description),
           logo_url = COALESCE($4, logo_url),
           updated_at = now()
       WHERE id = $1 AND deleted_at IS NULL
       RETURNING ${CREATOR_NAME_RETURNING}`,
      [id, fields.name || null, fields.description || null, fields.logoUrl || null]
    );
    return mapRow(rows[0]);
  }

  async softDelete(id) {
    const { rows } = await this.pool.query(
      `UPDATE providers SET deleted_at = now() WHERE id = $1 AND deleted_at IS NULL RETURNING ${CREATOR_NAME_RETURNING}`,
      [id]
    );
    return mapRow(rows[0]);
  }

  async findById(id) {
    const { rows } = await this.pool.query(
      `SELECT p.*, u.firstname || ' ' || u.lastname AS creator_name
       FROM providers p
       LEFT JOIN users u ON u.id = p.created_by
       WHERE p.id = $1 AND p.deleted_at IS NULL`,
      [id]
    );
    return mapRow(rows[0]);
  }

  async findByName(name) {
    const { rows } = await this.pool.query(
      `SELECT p.*, u.firstname || ' ' || u.lastname AS creator_name
       FROM providers p
       LEFT JOIN users u ON u.id = p.created_by
       WHERE p.name = $1 AND p.deleted_at IS NULL`,
      [name]
    );
    return mapRow(rows[0]);
  }

  async listAll() {
    const { rows } = await this.pool.query(
      `SELECT p.*, u.firstname || ' ' || u.lastname AS creator_name
       FROM providers p
       LEFT JOIN users u ON u.id = p.created_by
       WHERE p.deleted_at IS NULL
       ORDER BY p.name ASC`
    );
    return rows.map(mapRow);
  }
}

export { PgProviderRepository };
