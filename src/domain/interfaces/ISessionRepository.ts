import { notImplemented } from './notImplemented';

class ISessionRepository {
  async create(session): Promise<any> { notImplemented('ISessionRepository', 'create'); }
  async findById(id): Promise<any> { notImplemented('ISessionRepository', 'findById'); }
  async listAll(): Promise<any> { notImplemented('ISessionRepository', 'listAll'); }
  async listByInstructor(instructorId): Promise<any> { notImplemented('ISessionRepository', 'listByInstructor'); }
  async assignInstructor(sessionId, instructorId): Promise<any> { notImplemented('ISessionRepository', 'assignInstructor'); }
  async updateAssignmentStatus(sessionId, status): Promise<any> { notImplemented('ISessionRepository', 'updateAssignmentStatus'); }
  async updateSessionStatus(sessionId, status): Promise<any> { notImplemented('ISessionRepository', 'updateSessionStatus'); }
  async update(sessionId, fields): Promise<any> { notImplemented('ISessionRepository', 'update'); }
  async listAllWithDetails(): Promise<any> { notImplemented('ISessionRepository', 'listAllWithDetails'); }
  async listEndedWithoutReport(minutesAgo): Promise<any> { notImplemented('ISessionRepository', 'listEndedWithoutReport'); }
  async addAttendee(sessionId, attendee): Promise<any> { notImplemented('ISessionRepository', 'addAttendee'); }
  async listAttendees(sessionId): Promise<any> { notImplemented('ISessionRepository', 'listAttendees'); }
  async findAttendeeById(attendeeId): Promise<any> { notImplemented('ISessionRepository', 'findAttendeeById'); }
  async markAttendeeSurveySubmitted(attendeeId): Promise<any> { notImplemented('ISessionRepository', 'markAttendeeSurveySubmitted'); }
  async allAttendeesSubmitted(sessionId): Promise<any> { notImplemented('ISessionRepository', 'allAttendeesSubmitted'); }
}

export { ISessionRepository };
