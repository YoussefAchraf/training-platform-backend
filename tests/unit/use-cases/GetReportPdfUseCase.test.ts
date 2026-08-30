import { GetReportPdfUseCase } from '../../../src/use-cases/reports/GetReportPdfUseCase';

function buildRepos() {
  return {
    reportRepository: {
      findBySessionId: jest.fn().mockResolvedValue({ id: 1, sessionId: 5, averageScore: 4.2, npsAverage: 8, generatedAt: new Date() }),
    },
    sessionRepository: {
      findById: jest.fn().mockResolvedValue({ id: 5, trainingId: 1, clientId: 2, instructorId: 3, startDate: new Date(), endDate: new Date() }),
      listAttendees: jest.fn().mockResolvedValue([
        { id: 1, name: 'Alice', email: 'alice@example.com', attendanceStatus: 'present', surveySubmitted: true },
        { id: 2, name: 'Bob', email: 'bob@example.com', attendanceStatus: 'absent', surveySubmitted: false },
      ]),
    },
    trainingRepository: {
      findById: jest.fn().mockResolvedValue({ id: 1, name: 'Some Training', providerName: 'Some Provider' }),
    },
    clientRepository: {
      findById: jest.fn().mockResolvedValue({ id: 2, companyName: 'Some Client' }),
    },
    instructorRepository: {
      findById: jest.fn().mockResolvedValue({ id: 3, firstname: 'Jane', lastname: 'Instructor' }),
    },
    pdfReportService: {
      generateReportPdf: jest.fn().mockResolvedValue(Buffer.from('fake-pdf-bytes')),
    },
  };
}

describe('GetReportPdfUseCase', () => {
  it('rejects a session with no report yet', async () => {
    const repos = buildRepos();
    repos.reportRepository.findBySessionId.mockResolvedValue(null);
    const useCase = new GetReportPdfUseCase(repos);

    await expect(useCase.execute({ sessionId: 5 })).rejects.toThrow('Report not yet generated');
    expect(repos.sessionRepository.findById).not.toHaveBeenCalled();
  });

  it('rejects a session that does not exist', async () => {
    const repos = buildRepos();
    repos.sessionRepository.findById.mockResolvedValue(null);
    const useCase = new GetReportPdfUseCase(repos);

    await expect(useCase.execute({ sessionId: 999 })).rejects.toThrow('Training session not found');
  });

  it('generates a PDF buffer enriched with training, client, instructor, and attendee details', async () => {
    const repos = buildRepos();
    const useCase = new GetReportPdfUseCase(repos);

    const result = await useCase.execute({ sessionId: 5 });

    expect(result).toEqual(Buffer.from('fake-pdf-bytes'));
    expect(repos.pdfReportService.generateReportPdf).toHaveBeenCalledWith(
      expect.objectContaining({
        session: expect.objectContaining({ id: 5 }),
        training: expect.objectContaining({ name: 'Some Training', providerName: 'Some Provider' }),
        client: expect.objectContaining({ companyName: 'Some Client' }),
        instructor: expect.objectContaining({ firstname: 'Jane', lastname: 'Instructor' }),
        attendees: expect.arrayContaining([expect.objectContaining({ name: 'Alice' })]),
        report: expect.objectContaining({ sessionId: 5 }),
      })
    );
  });

  it('resolves instructor to null when no instructor is assigned', async () => {
    const repos = buildRepos();
    repos.sessionRepository.findById.mockResolvedValue({ id: 5, trainingId: 1, clientId: 2, instructorId: null, startDate: new Date(), endDate: new Date() });
    const useCase = new GetReportPdfUseCase(repos);

    await useCase.execute({ sessionId: 5 });

    expect(repos.instructorRepository.findById).not.toHaveBeenCalled();
    expect(repos.pdfReportService.generateReportPdf).toHaveBeenCalledWith(
      expect.objectContaining({ instructor: null })
    );
  });
});
