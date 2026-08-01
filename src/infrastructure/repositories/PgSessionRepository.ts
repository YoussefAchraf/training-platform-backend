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

  async update(sessionId, fields) {
    const { rows } = await this.pool.query(
      `UPDATE training_sessions
       SET start_date = COALESCE($2, start_date),
           end_date = COALESCE($3, end_date),
           updated_at = now()
       WHERE id = $1
       RETURNING *`,
      [sessionId, fields.startDate || null, fields.endDate || null]
    );
    return mapRow(rows[0]);
  }

  async listAllWithDetails() {
    const { rows } = await this.pool.query(`
      SELECT
        ts.id,
        ts.training_id,
        t.name AS training_name,
        ts.client_id,
        c.company_name AS client_company_name,
        ts.instructor_id,
        iu.firstname AS instructor_firstname,
        iu.lastname AS instructor_lastname,
        ts.start_date,
        ts.end_date,
        ts.session_status,
        ts.assignment_status,
        ts.created_by,
        cu.firstname AS creator_firstname,
        cu.lastname AS creator_lastname,
        cu.email AS creator_email,
        (SELECT COUNT(*)::int FROM session_attendees sa WHERE sa.session_id = ts.id) AS attendee_count,
        (SELECT COUNT(*)::int FROM session_attendees sa WHERE sa.session_id = ts.id AND sa.survey_submitted) AS attendee_surveys_submitted,
        (r.id IS NOT NULL) AS has_report
      FROM training_sessions ts
      JOIN trainings t ON t.id = ts.training_id
      JOIN clients c ON c.id = ts.client_id
      LEFT JOIN users cu ON cu.id = ts.created_by
      LEFT JOIN instructors i ON i.id = ts.instructor_id
      LEFT JOIN users iu ON iu.id = i.user_id
      LEFT JOIN reports r ON r.session_id = ts.id
      ORDER BY ts.start_date DESC
    `);

    return rows.map((row) => ({
      id: row.id,
      trainingId: row.training_id,
      trainingName: row.training_name,
      clientId: row.client_id,
      clientCompanyName: row.client_company_name,
      instructorId: row.instructor_id,
      instructorName: row.instructor_id ? `${row.instructor_firstname} ${row.instructor_lastname}` : null,
      startDate: row.start_date,
      endDate: row.end_date,
      sessionStatus: row.session_status,
      assignmentStatus: row.assignment_status,
      createdBy: row.created_by,
      creatorName: row.created_by ? `${row.creator_firstname} ${row.creator_lastname}` : null,
      creatorEmail: row.creator_email,
      attendeeCount: row.attendee_count,
      attendeeSurveysSubmitted: row.attendee_surveys_submitted,
      hasReport: row.has_report,
    }));
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

  async findAttendeeById(attendeeId) {
    const { rows } = await this.pool.query('SELECT * FROM session_attendees WHERE id = $1', [attendeeId]);
    return mapAttendeeRow(rows[0]);
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
