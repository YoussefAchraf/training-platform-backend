class SubmitSurveyUseCase {
  sessionRepository: any;
  surveyRepository: any;
  generateReportUseCase: any;

  constructor({ sessionRepository, surveyRepository, generateReportUseCase }) {
    this.sessionRepository = sessionRepository;
    this.surveyRepository = surveyRepository;
    
    
    this.generateReportUseCase = generateReportUseCase;
  }

  async execute({ sessionId, attendeeId, instructorScore, npsScore, comments }: { sessionId: any; attendeeId?: any; instructorScore: any; npsScore: any; comments?: any }) {
    const session = await this.sessionRepository.findById(sessionId);
    if (!session) throw new Error('Training session not found');
    if (!session.instructorId) throw new Error('This session has no instructor assigned yet');

    if (attendeeId) {
      const attendee = await this.sessionRepository.findAttendeeById(attendeeId);
      if (!attendee) throw new Error('Attendee not found');
      if (attendee.sessionId !== sessionId) throw new Error('This attendee is not registered for this session');
      if (attendee.surveySubmitted) throw new Error('This attendee has already submitted a survey for this session');
    }

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
