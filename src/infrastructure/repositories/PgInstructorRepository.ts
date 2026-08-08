import { Instructor } from '../../domain/entities/Instructor';
import { IInstructorRepository } from '../../domain/interfaces/IInstructorRepository';

function mapRow(row) {
  if (!row) return null;
  return new Instructor({
    id: row.id,
    userId: row.user_id,
    bio: row.bio,
    firstname: row.firstname,
    lastname: row.lastname,
    email: row.email,
    status: row.status,
  });
}

const SELECT_BASE = `
  SELECT i.*, u.firstname, u.lastname, u.email, u.status
  FROM instructors i
  JOIN users u ON u.id = i.user_id
`;

class PgInstructorRepository extends IInstructorRepository {
  pool: any;

  constructor(pool) {
    super();
    this.pool = pool;
  }

  async create(instructor) {
    const { rows } = await this.pool.query(
      `INSERT INTO instructors (user_id, bio) VALUES ($1, $2) RETURNING id`,
      [instructor.userId, instructor.bio || null]
    );
    return this.findById(rows[0].id);
  }

  async findById(id) {
    const { rows } = await this.pool.query(`${SELECT_BASE} WHERE i.id = $1`, [id]);
    const instructor = mapRow(rows[0]);
    if (instructor) instructor.skills = await this.getSkills(id);
    return instructor;
  }

  async findByUserId(userId) {
    const { rows } = await this.pool.query(`${SELECT_BASE} WHERE i.user_id = $1`, [userId]);
    const instructor = mapRow(rows[0]);
    if (instructor) instructor.skills = await this.getSkills(instructor.id);
    return instructor;
  }

  
  
  
  
  
  
  async listAll({ includeAllStatuses = false }: { includeAllStatuses?: boolean } = {}) {
    const where = includeAllStatuses ? '' : `WHERE u.status = 'approved'`;
    const { rows } = await this.pool.query(`${SELECT_BASE} ${where} ORDER BY u.lastname ASC`);
    const instructors = rows.map(mapRow);
    for (const instructor of instructors) {
      instructor.skills = await this.getSkills(instructor.id);
    }
    return instructors;
  }

  async isQualifiedForTraining(instructorId, trainingId) {
    const { rows } = await this.pool.query(
      'SELECT 1 FROM instructor_skills WHERE instructor_id = $1 AND training_id = $2',
      [instructorId, trainingId]
    );
    return rows.length > 0;
  }

  async updateBio(instructorId, bio) {
    await this.pool.query(
      `UPDATE instructors SET bio = $2, updated_at = now() WHERE id = $1`,
      [instructorId, bio]
    );
    return this.findById(instructorId);
  }

  async setSkills(instructorId, trainingIds) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('DELETE FROM instructor_skills WHERE instructor_id = $1', [instructorId]);
      for (const trainingId of trainingIds) {
        await client.query(
          'INSERT INTO instructor_skills (instructor_id, training_id) VALUES ($1, $2)',
          [instructorId, trainingId]
        );
      }
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
    return this.getSkills(instructorId);
  }

  async getSkills(instructorId) {
    const { rows } = await this.pool.query(
      `SELECT t.id AS training_id, t.name AS training_name
       FROM instructor_skills isk
       JOIN trainings t ON t.id = isk.training_id
       WHERE isk.instructor_id = $1`,
      [instructorId]
    );
    return rows.map((r) => ({ trainingId: r.training_id, trainingName: r.training_name }));
  }
}

export { PgInstructorRepository };
