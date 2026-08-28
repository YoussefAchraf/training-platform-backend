



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

describe('scheduling guards and attendance (PgSessionRepository)', () => {
  const repo = new PgSessionRepository(prismaClient);
  const marker = `session-guard-test-${Date.now()}`;
  let userId: number;
  let providerId: number;
  let trainingId: number;
  let otherTrainingId: number;
  let clientId: number;
  const sessionIds: number[] = [];

  beforeAll(async () => {
    const role = await prismaClient.roles.findFirstOrThrow();
    const user = await prismaClient.users.create({
      data: { firstname: 'Guard', lastname: 'Tester', email: `${marker}@example.com`, password_hash: 'x', role_id: role.id },
    });
    userId = user.id;
    const provider = await prismaClient.providers.create({ data: { name: marker } });
    providerId = provider.id;
    const training = await prismaClient.trainings.create({ data: { name: marker, provider_id: providerId } });
    trainingId = training.id;
    const otherTraining = await prismaClient.trainings.create({ data: { name: `${marker}-other`, provider_id: providerId } });
    otherTrainingId = otherTraining.id;
    const client = await prismaClient.clients.create({ data: { company_name: marker } });
    clientId = client.id;
  });

  afterAll(async () => {
    await prismaClient.session_attendees.deleteMany({ where: { session_id: { in: sessionIds } } });
    await prismaClient.training_sessions.deleteMany({ where: { id: { in: sessionIds } } });
    await prismaClient.trainings.deleteMany({ where: { id: { in: [trainingId, otherTrainingId] } } });
    await prismaClient.providers.delete({ where: { id: providerId } });
    await prismaClient.clients.delete({ where: { id: clientId } });
    await prismaClient.users.delete({ where: { id: userId } });
  });

  async function createSession({ startDate, endDate, trainingId: forTrainingId = trainingId }: any) {
    const session = await repo.create({ trainingId: forTrainingId, clientId, startDate, endDate, createdBy: userId });
    sessionIds.push(session.id);
    return session;
  }

  it('finds a conflict for the same training at the exact same start time', async () => {
    const start = new Date('2031-01-10T09:00:00Z');
    const end = new Date('2031-01-10T11:00:00Z');
    const first = await createSession({ startDate: start, endDate: end });

    const conflict = await repo.findConflictingSessionForTraining(trainingId, start);
    expect(conflict?.id).toBe(first.id);
  });

  it('does not conflict for a different training at the same start time', async () => {
    const start = new Date('2031-01-11T09:00:00Z');
    const end = new Date('2031-01-11T11:00:00Z');
    await createSession({ startDate: start, endDate: end, trainingId: otherTrainingId });

    const conflict = await repo.findConflictingSessionForTraining(trainingId, start);
    expect(conflict).toBeNull();
  });

  it('does not conflict for the same training on the same day at a different time', async () => {
    const start = new Date('2031-01-12T09:00:00Z');
    const end = new Date('2031-01-12T11:00:00Z');
    await createSession({ startDate: start, endDate: end });

    const conflict = await repo.findConflictingSessionForTraining(trainingId, new Date('2031-01-12T14:00:00Z'));
    expect(conflict).toBeNull();
  });

  it('ignores a cancelled session at the same training and start time', async () => {
    const start = new Date('2031-01-13T09:00:00Z');
    const end = new Date('2031-01-13T11:00:00Z');
    const session = await createSession({ startDate: start, endDate: end });
    await repo.updateSessionStatus(session.id, 'cancelled');

    const conflict = await repo.findConflictingSessionForTraining(trainingId, start);
    expect(conflict).toBeNull();
  });

  it('finds an overlapping session for an attendee by email', async () => {
    const sessionA = await createSession({ startDate: new Date('2031-02-01T09:00:00Z'), endDate: new Date('2031-02-01T11:00:00Z') });
    const sessionB = await createSession({ startDate: new Date('2031-02-01T10:00:00Z'), endDate: new Date('2031-02-01T12:00:00Z') });
    await repo.addAttendee(sessionA.id, { name: 'Overlap Attendee', email: `${marker}-overlap@example.com` });

    const conflict = await repo.findOverlappingAttendeeSession({
      email: `${marker}-overlap@example.com`,
      sessionId: sessionB.id,
      startDate: sessionB.startDate,
      endDate: sessionB.endDate,
    });
    expect(conflict?.id).toBe(sessionA.id);
  });

  it('does not conflict when sessions only touch at an exact boundary', async () => {
    const sessionA = await createSession({ startDate: new Date('2031-02-02T09:00:00Z'), endDate: new Date('2031-02-02T11:00:00Z') });
    const sessionB = await createSession({ startDate: new Date('2031-02-02T11:00:00Z'), endDate: new Date('2031-02-02T13:00:00Z') });
    await repo.addAttendee(sessionA.id, { name: 'Boundary Attendee', email: `${marker}-boundary@example.com` });

    const conflict = await repo.findOverlappingAttendeeSession({
      email: `${marker}-boundary@example.com`,
      sessionId: sessionB.id,
      startDate: sessionB.startDate,
      endDate: sessionB.endDate,
    });
    expect(conflict).toBeNull();
  });

  it('ignores a cancelled session when checking attendee overlap', async () => {
    const sessionA = await createSession({ startDate: new Date('2031-02-03T09:00:00Z'), endDate: new Date('2031-02-03T11:00:00Z') });
    const sessionB = await createSession({ startDate: new Date('2031-02-03T10:00:00Z'), endDate: new Date('2031-02-03T12:00:00Z') });
    await repo.addAttendee(sessionA.id, { name: 'Cancelled Attendee', email: `${marker}-cancelled@example.com` });
    await repo.updateSessionStatus(sessionA.id, 'cancelled');

    const conflict = await repo.findOverlappingAttendeeSession({
      email: `${marker}-cancelled@example.com`,
      sessionId: sessionB.id,
      startDate: sessionB.startDate,
      endDate: sessionB.endDate,
    });
    expect(conflict).toBeNull();
  });

  it('excludes the session being checked against itself', async () => {
    const sessionA = await createSession({ startDate: new Date('2031-02-04T09:00:00Z'), endDate: new Date('2031-02-04T11:00:00Z') });
    await repo.addAttendee(sessionA.id, { name: 'Self Attendee', email: `${marker}-self@example.com` });

    const conflict = await repo.findOverlappingAttendeeSession({
      email: `${marker}-self@example.com`,
      sessionId: sessionA.id,
      startDate: sessionA.startDate,
      endDate: sessionA.endDate,
    });
    expect(conflict).toBeNull();
  });

  it('bulk-inserts attendees defaulted to pending attendance', async () => {
    const session = await createSession({ startDate: new Date('2031-03-01T09:00:00Z'), endDate: new Date('2031-03-01T11:00:00Z') });

    const inserted = await repo.addAttendeesBulk(session.id, [
      { name: 'Bulk One', email: `${marker}-bulk1@example.com` },
      { name: 'Bulk Two', email: null },
    ]);

    expect(inserted).toHaveLength(2);
    expect(inserted.every((a) => a.attendanceStatus === 'pending')).toBe(true);
  });

  it('marks and reads back an attendee status', async () => {
    const session = await createSession({ startDate: new Date('2031-03-02T09:00:00Z'), endDate: new Date('2031-03-02T11:00:00Z') });
    const attendee = await repo.addAttendee(session.id, { name: 'Status Attendee', email: null });

    const updated = await repo.markAttendeeStatus(attendee.id, 'present');
    expect(updated.attendanceStatus).toBe('present');

    const refetched = await repo.findAttendeeById(attendee.id);
    expect(refetched.attendanceStatus).toBe('present');
  });
});
