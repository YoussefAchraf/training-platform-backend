import { SubmitSurveyUseCase } from '../../../src/use-cases/surveys/SubmitSurveyUseCase';

function buildRepos() {
  return {
    sessionRepository: {
      findById: jest.fn().mockResolvedValue({ id: 5, instructorId: 1 }),
      findAttendeeById: jest.fn().mockResolvedValue({ id: 9, sessionId: 5, surveySubmitted: false }),
      markAttendeeSurveySubmitted: jest.fn(),
      allAttendeesSubmitted: jest.fn().mockResolvedValue(false),
    },
    surveyRepository: {
      create: jest.fn().mockResolvedValue({ id: 1, sessionId: 5, attendeeId: 9, instructorScore: 4, npsScore: 9 }),
    },
    generateReportUseCase: { execute: jest.fn() },
  };
}

describe('SubmitSurveyUseCase', () => {
  it('rejects a session that does not exist', async () => {
    const { sessionRepository, surveyRepository, generateReportUseCase } = buildRepos();
    sessionRepository.findById.mockResolvedValue(null);
    const useCase = new SubmitSurveyUseCase({ sessionRepository, surveyRepository, generateReportUseCase });

    await expect(
      useCase.execute({ sessionId: 999, attendeeId: 9, instructorScore: 4, npsScore: 9 })
    ).rejects.toThrow('Training session not found');
  });

  it('rejects a session with no instructor assigned yet', async () => {
    const { sessionRepository, surveyRepository, generateReportUseCase } = buildRepos();
    sessionRepository.findById.mockResolvedValue({ id: 5, instructorId: null });
    const useCase = new SubmitSurveyUseCase({ sessionRepository, surveyRepository, generateReportUseCase });

    await expect(
      useCase.execute({ sessionId: 5, attendeeId: 9, instructorScore: 4, npsScore: 9 })
    ).rejects.toThrow('no instructor assigned yet');
  });

  it('rejects an attendeeId that does not exist', async () => {
    const { sessionRepository, surveyRepository, generateReportUseCase } = buildRepos();
    sessionRepository.findAttendeeById.mockResolvedValue(null);
    const useCase = new SubmitSurveyUseCase({ sessionRepository, surveyRepository, generateReportUseCase });

    await expect(
      useCase.execute({ sessionId: 5, attendeeId: 999, instructorScore: 4, npsScore: 9 })
    ).rejects.toThrow('Attendee not found');
    expect(surveyRepository.create).not.toHaveBeenCalled();
  });

  it('rejects an attendee registered for a different session', async () => {
    const { sessionRepository, surveyRepository, generateReportUseCase } = buildRepos();
    sessionRepository.findAttendeeById.mockResolvedValue({ id: 9, sessionId: 42, surveySubmitted: false });
    const useCase = new SubmitSurveyUseCase({ sessionRepository, surveyRepository, generateReportUseCase });

    await expect(
      useCase.execute({ sessionId: 5, attendeeId: 9, instructorScore: 4, npsScore: 9 })
    ).rejects.toThrow('not registered for this session');
    expect(surveyRepository.create).not.toHaveBeenCalled();
  });

  it('rejects a second submission from an attendee who already submitted', async () => {
    const { sessionRepository, surveyRepository, generateReportUseCase } = buildRepos();
    sessionRepository.findAttendeeById.mockResolvedValue({ id: 9, sessionId: 5, surveySubmitted: true });
    const useCase = new SubmitSurveyUseCase({ sessionRepository, surveyRepository, generateReportUseCase });

    await expect(
      useCase.execute({ sessionId: 5, attendeeId: 9, instructorScore: 1, npsScore: 0 })
    ).rejects.toThrow('already submitted a survey');
    expect(surveyRepository.create).not.toHaveBeenCalled();
  });

  it('accepts a first-time submission and marks the attendee as submitted', async () => {
    const { sessionRepository, surveyRepository, generateReportUseCase } = buildRepos();
    const useCase = new SubmitSurveyUseCase({ sessionRepository, surveyRepository, generateReportUseCase });

    await useCase.execute({ sessionId: 5, attendeeId: 9, instructorScore: 4, npsScore: 9 });

    expect(surveyRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ sessionId: 5, attendeeId: 9, instructorScore: 4, npsScore: 9 })
    );
    expect(sessionRepository.markAttendeeSurveySubmitted).toHaveBeenCalledWith(9);
  });

  it('allows an anonymous submission with no attendeeId, skipping the attendee checks entirely', async () => {
    const { sessionRepository, surveyRepository, generateReportUseCase } = buildRepos();
    const useCase = new SubmitSurveyUseCase({ sessionRepository, surveyRepository, generateReportUseCase });

    await useCase.execute({ sessionId: 5, instructorScore: 5, npsScore: 10 });

    expect(sessionRepository.findAttendeeById).not.toHaveBeenCalled();
    expect(sessionRepository.markAttendeeSurveySubmitted).not.toHaveBeenCalled();
    expect(surveyRepository.create).toHaveBeenCalledWith(expect.objectContaining({ attendeeId: null }));
  });

  it('triggers report generation once every attendee has submitted', async () => {
    const { sessionRepository, surveyRepository, generateReportUseCase } = buildRepos();
    sessionRepository.allAttendeesSubmitted.mockResolvedValue(true);
    const useCase = new SubmitSurveyUseCase({ sessionRepository, surveyRepository, generateReportUseCase });

    await useCase.execute({ sessionId: 5, attendeeId: 9, instructorScore: 4, npsScore: 9 });

    expect(generateReportUseCase.execute).toHaveBeenCalledWith({ sessionId: 5, triggeredBy: 'all_submitted' });
  });
});
