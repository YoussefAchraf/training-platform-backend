




import { PgSurveyRepository } from '../../src/infrastructure/repositories/PgSurveyRepository';
import { PgReportRepository } from '../../src/infrastructure/repositories/PgReportRepository';
import { prismaClient } from '../../src/infrastructure/database/prismaClient';

describe('PgSurveyRepository + PgReportRepository (Prisma, real database)', () => {
  const surveyRepo = new PgSurveyRepository(prismaClient);
  const reportRepo = new PgReportRepository(prismaClient);
  const marker = `survey-test-${Date.now()}`;
  let userId: number;
  let instructorId: number;
  let providerId: number;
  let trainingId: number;
  let clientId: number;
  let sessionId: number;

  beforeAll(async () => {
    const role = await prismaClient.roles.findFirstOrThrow();
    const user = await prismaClient.users.create({
      data: { firstname: 'Survey', lastname: 'Tester', email: `${marker}@example.com`, password_hash: 'x', role_id: role.id },
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

    const session = await prismaClient.training_sessions.create({
      data: {
        training_id: trainingId,
        client_id: clientId,
        instructor_id: instructorId,
        start_date: new Date(),
        end_date: new Date(Date.now() + 60 * 60000),
      },
    });
    sessionId = session.id;
  });

  afterAll(async () => {
    await prismaClient.reports.deleteMany({ where: { session_id: sessionId } });
    await prismaClient.surveys.deleteMany({ where: { session_id: sessionId } });
    await prismaClient.training_sessions.delete({ where: { id: sessionId } });
    await prismaClient.trainings.delete({ where: { id: trainingId } });
    await prismaClient.providers.delete({ where: { id: providerId } });
    await prismaClient.clients.delete({ where: { id: clientId } });
    await prismaClient.instructors.delete({ where: { id: instructorId } });
    await prismaClient.users.delete({ where: { id: userId } });
    await prismaClient.$disconnect();
  });

  it('computes the exact NPS detractor/passive/promoter percentage and average score', async () => {
    
    
    
    await surveyRepo.create({ sessionId, instructorId, instructorScore: 4, npsScore: 6 });
    await surveyRepo.create({ sessionId, instructorId, instructorScore: 5, npsScore: 8 });
    await surveyRepo.create({ sessionId, instructorId, instructorScore: 5, npsScore: 10 });

    const averages = await surveyRepo.getSessionAverages(sessionId);
    expect(averages.average_score).toBe('4.67');
    expect(averages.nps_average).toBe('0.00');
    expect(averages.total_responses).toBe(3);

    const list = await surveyRepo.listBySession(sessionId);
    expect(list).toHaveLength(3);
  });

  it('report create/find round-trips fixed 2-decimal strings and upserts on session_id', async () => {
    const averages = await surveyRepo.getSessionAverages(sessionId);
    const created = await reportRepo.create({
      sessionId,
      pdfUrl: `/reports/${sessionId}/pdf`,
      averageScore: averages.average_score,
      npsAverage: averages.nps_average,
    });
    expect(created.averageScore).toBe('4.67');
    expect(created.npsAverage).toBe('0.00');

    
    const updated = await reportRepo.create({
      sessionId,
      pdfUrl: `/reports/${sessionId}/pdf`,
      averageScore: '5.00',
      npsAverage: '100.00',
    });
    expect(updated.id).toBe(created.id);
    expect(updated.averageScore).toBe('5.00');

    const found = await reportRepo.findBySessionId(sessionId);
    expect(found.npsAverage).toBe('100.00');
  });
});
