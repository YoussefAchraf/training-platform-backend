import { CalendarEvent } from '../../domain/entities/CalendarEvent';
import { ICalendarRepository } from '../../domain/interfaces/ICalendarRepository';

function mapRow(row) {
  if (!row) return null;
  return new CalendarEvent({
    id: row.id,
    sessionId: row.session_id,
    eventDate: row.event_date,
    title: row.title,
  });
}

class PgCalendarRepository extends ICalendarRepository {
  pool: any;

  constructor(pool) {
    super();
    this.pool = pool;
  }

  async create(event) {
    const { rows } = await this.pool.query(
      `INSERT INTO calendar (session_id, event_date, title) VALUES ($1, $2, $3) RETURNING *`,
      [event.sessionId, event.eventDate, event.title]
    );
    return mapRow(rows[0]);
  }

  
  async listGlobal() {
    const { rows } = await this.pool.query(
      `SELECT c.*
       FROM calendar c
       ORDER BY c.event_date ASC`
    );
    return rows.map(mapRow);
  }

  
  async listForInstructor(instructorId) {
    const { rows } = await this.pool.query(
      `SELECT c.*
       FROM calendar c
       JOIN training_sessions ts ON ts.id = c.session_id
       WHERE ts.instructor_id = $1
       ORDER BY c.event_date ASC`,
      [instructorId]
    );
    return rows.map(mapRow);
  }

  async update(eventId, changes) {
    const { rows } = await this.pool.query(
      `UPDATE calendar SET event_date = COALESCE($2, event_date), title = COALESCE($3, title) WHERE id = $1 RETURNING *`,
      [eventId, changes.eventDate || null, changes.title || null]
    );
    return mapRow(rows[0]);
  }

  async delete(eventId) {
    await this.pool.query('DELETE FROM calendar WHERE id = $1', [eventId]);
    return true;
  }
}

export { PgCalendarRepository };
