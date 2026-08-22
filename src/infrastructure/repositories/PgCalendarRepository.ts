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
  prisma: any;

  constructor(prisma) {
    super();
    this.prisma = prisma;
  }

  async create(event) {
    const row = await this.prisma.calendar.create({
      data: { session_id: event.sessionId, event_date: event.eventDate, title: event.title },
    });
    return mapRow(row);
  }

  async listGlobal() {
    const rows = await this.prisma.calendar.findMany({ orderBy: { event_date: 'asc' } });
    return rows.map(mapRow);
  }

  async listForInstructor(instructorId) {
    const rows = await this.prisma.calendar.findMany({
      where: { training_sessions: { instructor_id: instructorId } },
      orderBy: { event_date: 'asc' },
    });
    return rows.map(mapRow);
  }

  async update(eventId, changes) {
    
    
    
    
    const data: any = {};
    if (changes.eventDate) data.event_date = changes.eventDate;
    if (changes.title) data.title = changes.title;

    const row = await this.prisma.calendar.update({ where: { id: eventId }, data });
    return mapRow(row);
  }

  async delete(eventId) {
    
    
    
    await this.prisma.calendar.deleteMany({ where: { id: eventId } });
    return true;
  }
}

export { PgCalendarRepository };
