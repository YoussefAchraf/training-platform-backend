import { Provider } from '../../domain/entities/Provider';
import { IProviderRepository } from '../../domain/interfaces/IProviderRepository';

function mapRow(row) {
  if (!row) return null;
  return new Provider({
    id: row.id,
    name: row.name,
    description: row.description,
    createdBy: row.created_by,
    createdAt: row.created_at,
  });
}

class PgProviderRepository extends IProviderRepository {
  pool: any;

  constructor(pool) {
    super();
    this.pool = pool;
  }

  async create(provider) {
    const { rows } = await this.pool.query(
      `INSERT INTO providers (name, description, created_by) VALUES ($1, $2, $3) RETURNING *`,
      [provider.name, provider.description, provider.createdBy]
    );
    return mapRow(rows[0]);
  }

  async update(id, fields) {
    const { rows } = await this.pool.query(
      `UPDATE providers
       SET name = COALESCE($2, name),
           description = COALESCE($3, description),
           updated_at = now()
       WHERE id = $1 AND deleted_at IS NULL
       RETURNING *`,
      [id, fields.name || null, fields.description || null]
    );
    return mapRow(rows[0]);
  }

  async softDelete(id) {
    const { rows } = await this.pool.query(
      `UPDATE providers SET deleted_at = now() WHERE id = $1 AND deleted_at IS NULL RETURNING *`,
      [id]
    );
    return mapRow(rows[0]);
  }

  async findById(id) {
    const { rows } = await this.pool.query(
      'SELECT * FROM providers WHERE id = $1 AND deleted_at IS NULL',
      [id]
    );
    return mapRow(rows[0]);
  }

  async findByName(name) {
    const { rows } = await this.pool.query(
      'SELECT * FROM providers WHERE name = $1 AND deleted_at IS NULL',
      [name]
    );
    return mapRow(rows[0]);
  }

  async listAll() {
    const { rows } = await this.pool.query(
      'SELECT * FROM providers WHERE deleted_at IS NULL ORDER BY name ASC'
    );
    return rows.map(mapRow);
  }
}

export { PgProviderRepository };
