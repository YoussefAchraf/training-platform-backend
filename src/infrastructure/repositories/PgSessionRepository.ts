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
    includeWeekends: row.include_weekends,
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
    attendanceStatus: row.attendance_status,
  });
}

class PgSessionRepository extends ISessionRepository {
  prisma: any;

  constructor(prisma) {
    super();
    this.prisma = prisma;
  }

  async create(session) {
    const row = await this.prisma.training_sessions.create({
      data: {
        training_id: session.trainingId,
        client_id: session.clientId,
        instructor_id: session.instructorId || null,
        start_date: session.startDate,
        end_date: session.endDate,
        session_status: session.sessionStatus || 'scheduled',
        assignment_status: session.instructorId ? 'pending' : 'unassigned',
        include_weekends: session.includeWeekends || false,
        created_by: session.createdBy,
      },
    });
    return mapRow(row);
  }

  async findById(id) {
    const row = await this.prisma.training_sessions.findUnique({ where: { id } });
    return mapRow(row);
  }

  async listAll() {
    const rows = await this.prisma.training_sessions.findMany({ orderBy: { start_date: 'desc' } });
    return rows.map(mapRow);
  }

  async listByInstructor(instructorId) {
    const rows = await this.prisma.training_sessions.findMany({
      where: { instructor_id: instructorId },
      orderBy: { start_date: 'asc' },
    });
    return rows.map(mapRow);
  }

  async assignInstructor(sessionId, instructorId) {
    
    
    
    
    
    
    const result = await this.prisma.training_sessions.updateMany({
      where: { id: sessionId },
      data: { instructor_id: instructorId, assignment_status: 'accepted', updated_at: new Date() },
    });
    if (result.count === 0) return null;
    return this.findById(sessionId);
  }

  async updateAssignmentStatus(sessionId, status) {
    const result = await this.prisma.training_sessions.updateMany({
      where: { id: sessionId },
      data: { assignment_status: status, updated_at: new Date() },
    });
    if (result.count === 0) return null;
    return this.findById(sessionId);
  }

  async updateSessionStatus(sessionId, status) {
    const result = await this.prisma.training_sessions.updateMany({
      where: { id: sessionId },
      data: { session_status: status, updated_at: new Date() },
    });
    if (result.count === 0) return null;
    return this.findById(sessionId);
  }

  async update(sessionId, fields) {
    const data: any = { updated_at: new Date() };
    if (fields.startDate) data.start_date = fields.startDate;
    if (fields.endDate) data.end_date = fields.endDate;

    const result = await this.prisma.training_sessions.updateMany({ where: { id: sessionId }, data });
    if (result.count === 0) return null;
    return this.findById(sessionId);
  }

  async listAllWithDetails() {
    
    
    
    
    
    
    const rows = await this.prisma.$queryRaw<any[]>`
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
    `;

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
    
    
    
    
    
    
    
    
    
    
    const rows = await this.prisma.$queryRaw<any[]>`
      SELECT ts.*
      FROM training_sessions ts
      LEFT JOIN reports r ON r.session_id = ts.id
      WHERE r.id IS NULL
        AND ts.end_date <= now() - (${minutesAgo}::text || ' minutes')::interval
      ORDER BY ts.end_date ASC
    `;
    return rows.map(mapRow);
  }

  async addAttendee(sessionId, attendee) {
    const row = await this.prisma.session_attendees.create({
      data: { session_id: sessionId, name: attendee.name, email: attendee.email || null },
    });
    return mapAttendeeRow(row);
  }

  async listAttendees(sessionId) {
    const rows = await this.prisma.session_attendees.findMany({
      where: { session_id: sessionId },
      orderBy: { name: 'asc' },
    });
    return rows.map(mapAttendeeRow);
  }

  async findAttendeeById(attendeeId) {
    const row = await this.prisma.session_attendees.findUnique({ where: { id: attendeeId } });
    return mapAttendeeRow(row);
  }

  async markAttendeeSurveySubmitted(attendeeId) {
    const result = await this.prisma.session_attendees.updateMany({
      where: { id: attendeeId },
      data: { survey_submitted: true },
    });
    if (result.count === 0) return null;
    return this.findAttendeeById(attendeeId);
  }

  async allAttendeesSubmitted(sessionId) {
    const total = await this.prisma.session_attendees.count({ where: { session_id: sessionId } });
    const submitted = await this.prisma.session_attendees.count({
      where: { session_id: sessionId, survey_submitted: true },
    });
    return total > 0 && total === submitted;
  }

  async findConflictingSessionForTraining(trainingId, startDate) {
    const row = await this.prisma.training_sessions.findFirst({
      where: {
        training_id: trainingId,
        start_date: new Date(startDate),
        session_status: { not: 'cancelled' },
      },
    });
    return mapRow(row);
  }

  async findOverlappingAttendeeSession({ email, sessionId, startDate, endDate }) {
    const rows = await this.prisma.$queryRaw<any[]>`
      SELECT ts.id, ts.start_date, ts.end_date, ts.training_id
      FROM session_attendees sa
      JOIN training_sessions ts ON ts.id = sa.session_id
      WHERE LOWER(sa.email) = LOWER(${email})
        AND sa.session_id != ${sessionId}
        AND ts.session_status != 'cancelled'
        AND ts.start_date < ${new Date(endDate)}
        AND ${new Date(startDate)} < ts.end_date
      LIMIT 1
    `;
    return rows[0] ?? null;
  }

  async findConflictingSessionForInstructor({ instructorId, sessionId, startDate }) {
    const row = await this.prisma.training_sessions.findFirst({
      where: {
        instructor_id: instructorId,
        id: { not: sessionId },
        session_status: { not: 'cancelled' },
        start_date: new Date(startDate),
      },
    });
    return mapRow(row);
  }

  async addAttendeesBulk(sessionId, attendees) {
    if (!attendees.length) return [];
    const rows = await this.prisma.session_attendees.createManyAndReturn({
      data: attendees.map((a) => ({ session_id: sessionId, name: a.name, email: a.email || null })),
    });
    return rows.map(mapAttendeeRow);
  }

  async markAttendeeStatus(attendeeId, status) {
    const result = await this.prisma.session_attendees.updateMany({
      where: { id: attendeeId },
      data: { attendance_status: status },
    });
    if (result.count === 0) return null;
    return this.findAttendeeById(attendeeId);
  }
}

export { PgSessionRepository };
