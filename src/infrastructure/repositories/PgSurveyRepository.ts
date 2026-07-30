import { Survey } from '../../domain/entities/Survey';
import { ISurveyRepository } from '../../domain/interfaces/ISurveyRepository';

function mapRow(row) {
  if (!row) return null;
  return new Survey({
    id: row.id,
    sessionId: row.session_id,
    instructorId: row.instructor_id,
    attendeeId: row.attendee_id,
    instructorScore: row.instructor_score,
    npsScore: row.nps_score,
    comments: row.comments,
    submittedAt: row.submitted_at,
  });
}

class PgSurveyRepository extends ISurveyRepository {
  pool: any;

  constructor(pool) {
    super();
    this.pool = pool;
  }

  async create(survey) {
    const { rows } = await this.pool.query(
      `INSERT INTO surveys (session_id, instructor_id, attendee_id, instructor_score, nps_score, comments)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        survey.sessionId,
        survey.instructorId,
        survey.attendeeId || null,
        survey.instructorScore,
        survey.npsScore,
        survey.comments || null,
      ]
    );
    return mapRow(rows[0]);
  }

  async listBySession(sessionId) {
    const { rows } = await this.pool.query(
      'SELECT * FROM surveys WHERE session_id = $1 ORDER BY submitted_at ASC',
      [sessionId]
    );
    return rows.map(mapRow);
  }

  async getSessionAverages(sessionId) {
    const { rows } = await this.pool.query(
      `SELECT
         COALESCE(AVG(instructor_score), 0)::numeric(4,2) AS average_score,
         COALESCE(AVG(nps_score), 0)::numeric(4,2) AS nps_average,
         COUNT(*)::int AS total_responses
       FROM surveys WHERE session_id = $1`,
      [sessionId]
    );
    return rows[0];
  }
}

export { PgSurveyRepository };
