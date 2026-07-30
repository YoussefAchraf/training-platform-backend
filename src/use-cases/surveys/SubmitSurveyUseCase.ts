class SubmitSurveyUseCase {
  sessionRepository: any;
  surveyRepository: any;
  generateReportUseCase: any;

  constructor({ sessionRepository, surveyRepository, generateReportUseCase }) {
    this.sessionRepository = sessionRepository;
    this.surveyRepository = surveyRepository;
    
    
    this.generateReportUseCase = generateReportUseCase;
  }

  async execute({ sessionId, attendeeId, instructorScore, npsScore, comments }) {
    const session = await this.sessionRepository.findById(sessionId);
    if (!session) throw new Error('Training session not found');
    if (!session.instructorId) throw new Error('This session has no instructor assigned yet');

    const survey = await this.surveyRepository.create({
      sessionId,
      instructorId: session.instructorId,
      attendeeId: attendeeId || null,
      instructorScore,
      npsScore,
      comments,
    });

    if (attendeeId) {
      await this.sessionRepository.markAttendeeSurveySubmitted(attendeeId);
    }

    
    
    const allSubmitted = await this.sessionRepository.allAttendeesSubmitted(sessionId);
    if (allSubmitted) {
      await this.generateReportUseCase.execute({ sessionId, triggeredBy: 'all_submitted' });
    }

    return survey;
  }
}

export { SubmitSurveyUseCase };
