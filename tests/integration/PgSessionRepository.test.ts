



import { PgSessionRepository } from '../../src/infrastructure/repositories/PgSessionRepository';
import { prismaClient } from '../../src/infrastructure/database/prismaClient';

describe('PgSessionRepository (Prisma, real database)', () => {
  const repo = new PgSessionRepository(prismaClient);
  const marker = `session-test-${Date.now()}`;
  let userId: number;
  let instructorId: number;
  let providerId: number;
  let trainingId: number;
  let clientId: number;
  let sessionId: number;

  beforeAll(async () => {
    const role = await prismaClient.roles.findFirstOrThrow();
    const user = await prismaClient.users.create({
      data: { firstname: 'Session', lastname: 'Tester', email: `${marker}@example.com`, password_hash: 'x', role_id: role.id },
    });
    userId = user.id;

    const instructor = await prismaClient.instructors.create({ data: { user_id: userId } });
    instructorId = instructor.id;

    const provider = await prismaClient.providers.create({ data: { name: marker } });
    providerId = provider.id;
    const training = await prismaClient.trainings.create({ data: { name: marker, provider_id: providerId } });
    trainingId = training.id;
    const client = await prismaClient.clients.create({ data: { company_name: marker } });
    clientId = client.id;
  });

  afterAll(async () => {
    await prismaClient.session_attendees.deleteMany({ where: { session_id: sessionId } });
    await prismaClient.training_sessions.deleteMany({ where: { id: sessionId } });
    await prismaClient.trainings.delete({ where: { id: trainingId } });
    await prismaClient.providers.delete({ where: { id: providerId } });
    await prismaClient.clients.delete({ where: { id: clientId } });
    await prismaClient.instructors.delete({ where: { id: instructorId } });
    await prismaClient.users.delete({ where: { id: userId } });
    await prismaClient.$disconnect();
  });

  it('creates a session with defaulted statuses and updates via the non-throwing pattern', async () => {
    
    const started = new Date(Date.now() - 2 * 60000);
    const ended = new Date(Date.now() - 60000);
    const session = await repo.create({ trainingId, clientId, startDate: started, endDate: ended, createdBy: userId });
    sessionId = session.id;
    expect(session.sessionStatus).toBe('scheduled');
    expect(session.assignmentStatus).toBe('unassigned');

    const assigned = await repo.assignInstructor(sessionId, instructorId);
    expect(assigned.instructorId).toBe(instructorId);
    expect(assigned.assignmentStatus).toBe('pending');

    
    const missing = await repo.assignInstructor(999999999, instructorId);
    expect(missing).toBeNull();

    const statusUpdated = await repo.updateSessionStatus(sessionId, 'completed');
    expect(statusUpdated.sessionStatus).toBe('completed');
  });

  it('listAllWithDetails joins training/client/instructor/creator names and attendee counts', async () => {
    await repo.addAttendee(sessionId, { name: 'Attendee One', email: 'one@example.com' });
    const attendeeTwo = await repo.addAttendee(sessionId, { name: 'Attendee Two' });
    await repo.markAttendeeSurveySubmitted(attendeeTwo.id);

    const details = await repo.listAllWithDetails();
    const row = details.find((d) => d.id === sessionId);
    expect(row).toBeDefined();
    expect(row.trainingName).toBe(marker);
    expect(row.clientCompanyName).toBe(marker);
    expect(row.instructorName).toBe('Session Tester');
    expect(row.creatorName).toBe('Session Tester');
    expect(row.attendeeCount).toBe(2);
    expect(row.attendeeSurveysSubmitted).toBe(1);
    expect(row.hasReport).toBe(false);

    const allSubmitted = await repo.allAttendeesSubmitted(sessionId);
    expect(allSubmitted).toBe(false);
  });

  it('listEndedWithoutReport finds sessions past the threshold using DB-side now()', async () => {
    const candidates = await repo.listEndedWithoutReport(0);
    expect(candidates.map((s) => s.id)).toContain(sessionId);

    const noneYet = await repo.listEndedWithoutReport(120);
    expect(noneYet.map((s) => s.id)).not.toContain(sessionId);
  });
});
