import { SessionAttendee } from '../../domain/entities/SessionAttendee';
import { TrainingSession } from '../../domain/entities/TrainingSession';
import { ISessionRepository } from '../../domain/interfaces/ISessionRepository';

function mapRow(row) {
  if (!row) return null;
  return new TrainingSession({
    id: row.id,
    trainingId: row.training_id,
    clientId: row.client_id,
    instructorId: row.instructor_id,
    startDate: row.start_date,
    endDate: row.end_date,
    sessionStatus: row.session_status,
    assignmentStatus: row.assignment_status,
    createdBy: row.created_by,
    createdAt: row.created_at,
  });
}

function mapAttendeeRow(row) {
  if (!row) return null;
  return new SessionAttendee({
    id: row.id,
    sessionId: row.session_id,
    name: row.name,
    email: row.email,
    surveySubmitted: row.survey_submitted,
  });
}

class PgSessionRepository extends ISessionRepository {
  pool: any;

  constructor(pool) {
    super();
    this.pool = pool;
  }

  async create(session) {
    const { rows } = await this.pool.query(
      `INSERT INTO training_sessions
         (training_id, client_id, instructor_id, start_date, end_date, session_status, assignment_status, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        session.trainingId,
        session.clientId,
        session.instructorId || null,
        session.startDate,
        session.endDate,
        session.sessionStatus || 'scheduled',
        session.instructorId ? 'pending' : 'unassigned',
        session.createdBy,
      ]
    );
    return mapRow(rows[0]);
  }

  async findById(id) {
    const { rows } = await this.pool.query('SELECT * FROM training_sessions WHERE id = $1', [id]);
    return mapRow(rows[0]);
  }

  async listAll() {
    const { rows } = await this.pool.query('SELECT * FROM training_sessions ORDER BY start_date DESC');
    return rows.map(mapRow);
  }

  async listByInstructor(instructorId) {
    const { rows } = await this.pool.query(
      'SELECT * FROM training_sessions WHERE instructor_id = $1 ORDER BY start_date ASC',
      [instructorId]
    );
    return rows.map(mapRow);
  }

  async assignInstructor(sessionId, instructorId) {
    const { rows } = await this.pool.query(
      `UPDATE training_sessions
       SET instructor_id = $2, assignment_status = 'pending', updated_at = now()
       WHERE id = $1
       RETURNING *`,
      [sessionId, instructorId]
    );
    return mapRow(rows[0]);
  }

  async updateAssignmentStatus(sessionId, status) {
    const { rows } = await this.pool.query(
      `UPDATE training_sessions SET assignment_status = $2, updated_at = now() WHERE id = $1 RETURNING *`,
      [sessionId, status]
    );
    return mapRow(rows[0]);
  }

  async updateSessionStatus(sessionId, status) {
    const { rows } = await this.pool.query(
      `UPDATE training_sessions SET session_status = $2, updated_at = now() WHERE id = $1 RETURNING *`,
      [sessionId, status]
    );
    return mapRow(rows[0]);
  }

  
  
  async listEndedWithoutReport(minutesAgo) {
    const { rows } = await this.pool.query(
      `SELECT ts.*
       FROM training_sessions ts
       LEFT JOIN reports r ON r.session_id = ts.id
       WHERE r.id IS NULL
         AND ts.end_date <= now() - ($1 || ' minutes')::interval
       ORDER BY ts.end_date ASC`,
      [minutesAgo]
    );
    return rows.map(mapRow);
  }

  async addAttendee(sessionId, attendee) {
    const { rows } = await this.pool.query(
      `INSERT INTO session_attendees (session_id, name, email) VALUES ($1, $2, $3) RETURNING *`,
      [sessionId, attendee.name, attendee.email || null]
    );
    return mapAttendeeRow(rows[0]);
  }

  async listAttendees(sessionId) {
    const { rows } = await this.pool.query(
      'SELECT * FROM session_attendees WHERE session_id = $1 ORDER BY name ASC',
      [sessionId]
    );
    return rows.map(mapAttendeeRow);
  }

  async markAttendeeSurveySubmitted(attendeeId) {
    const { rows } = await this.pool.query(
      `UPDATE session_attendees SET survey_submitted = TRUE WHERE id = $1 RETURNING *`,
      [attendeeId]
    );
    return mapAttendeeRow(rows[0]);
  }

  
  async allAttendeesSubmitted(sessionId) {
    const { rows } = await this.pool.query(
      `SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE survey_submitted) ::int AS submitted
       FROM session_attendees WHERE session_id = $1`,
      [sessionId]
    );
    const { total, submitted } = rows[0];
    return total > 0 && total === submitted;
  }
}

export { PgSessionRepository };
