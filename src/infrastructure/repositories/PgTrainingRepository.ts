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
    createdAt: row.created_at,
  });
}

const SELECT_BASE = `
  SELECT t.*, p.name AS provider_name
  FROM trainings t
  JOIN providers p ON p.id = t.provider_id
  WHERE t.deleted_at IS NULL
`;

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
}

export { PgTrainingRepository };
