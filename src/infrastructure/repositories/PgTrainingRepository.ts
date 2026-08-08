import { Training } from '../../domain/entities/Training';
import { ITrainingRepository } from '../../domain/interfaces/ITrainingRepository';

function mapRow(row) {
  if (!row) return null;
  return new Training({
    id: row.id,
    name: row.name,
    providerId: row.provider_id,
    providerName: row.provider_name,
    description: row.description,
    duration: row.duration,
    createdBy: row.created_by,
    creatorName: row.creator_name,
    createdAt: row.created_at,
  });
}

const SELECT_BASE = `
  SELECT t.*, p.name AS provider_name, u.firstname || ' ' || u.lastname AS creator_name
  FROM trainings t
  JOIN providers p ON p.id = t.provider_id
  LEFT JOIN users u ON u.id = t.created_by
  WHERE t.deleted_at IS NULL
`;



const CREATOR_NAME_RETURNING = `*, (SELECT firstname || ' ' || lastname FROM users WHERE id = created_by) AS creator_name`;

class PgTrainingRepository extends ITrainingRepository {
  pool: any;

  constructor(pool) {
    super();
    this.pool = pool;
  }

  async create(training) {
    const { rows } = await this.pool.query(
      `INSERT INTO trainings (name, provider_id, description, duration, created_by)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [training.name, training.providerId, training.description, training.duration, training.createdBy]
    );
    return this.findById(rows[0].id);
  }

  async findById(id) {
    const { rows } = await this.pool.query(`${SELECT_BASE} AND t.id = $1`, [id]);
    return mapRow(rows[0]);
  }

  async listAll() {
    const { rows } = await this.pool.query(`${SELECT_BASE} ORDER BY t.created_at DESC`);
    return rows.map(mapRow);
  }

  async listByProvider(providerId) {
    const { rows } = await this.pool.query(`${SELECT_BASE} AND t.provider_id = $1`, [providerId]);
    return rows.map(mapRow);
  }

  async update(id, fields) {
    await this.pool.query(
      `UPDATE trainings
       SET name = COALESCE($2, name),
           description = COALESCE($3, description),
           duration = COALESCE($4, duration),
           updated_at = now()
       WHERE id = $1 AND deleted_at IS NULL`,
      [id, fields.name || null, fields.description || null, fields.duration ?? null]
    );
    return this.findById(id);
  }

  async softDelete(id) {
    const { rows } = await this.pool.query(
      `UPDATE trainings SET deleted_at = now() WHERE id = $1 AND deleted_at IS NULL RETURNING ${CREATOR_NAME_RETURNING}`,
      [id]
    );
    return mapRow(rows[0]);
  }
}

export { PgTrainingRepository };
