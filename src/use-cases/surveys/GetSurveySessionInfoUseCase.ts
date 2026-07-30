class GetSurveySessionInfoUseCase {
  sessionRepository: any;
  trainingRepository: any;
  instructorRepository: any;

  constructor({ sessionRepository, trainingRepository, instructorRepository }) {
    this.sessionRepository = sessionRepository;
    this.trainingRepository = trainingRepository;
    this.instructorRepository = instructorRepository;
  }

  async execute({ sessionId }) {
    const session = await this.sessionRepository.findById(sessionId);
    if (!session) throw new Error('Training session not found');

    const training = await this.trainingRepository.findById(session.trainingId);
    const instructor = session.instructorId
      ? await this.instructorRepository.findById(session.instructorId)
      : null;

    return {
      sessionId: session.id,
      trainingName: training ? training.name : null,
      instructorName: instructor ? `${instructor.firstname} ${instructor.lastname}` : null,
      startDate: session.startDate,
      endDate: session.endDate,
    };
  }
}

export { GetSurveySessionInfoUseCase };
