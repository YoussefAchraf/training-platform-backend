class AssignInstructorUseCase {
  sessionRepository: any;
  instructorRepository: any;

  constructor({ sessionRepository, instructorRepository }) {
    this.sessionRepository = sessionRepository;
    this.instructorRepository = instructorRepository;
  }

  async execute({ requester, sessionId, instructorId }) {
    
    if (!requester.isManager() && !requester.isSuperAdmin()) {
      throw new Error('Only a Manager can assign a training session to an instructor');
    }

    const session = await this.sessionRepository.findById(sessionId);
    if (!session) throw new Error('Training session not found');

    const instructor = await this.instructorRepository.findById(instructorId);
    if (!instructor) throw new Error('Instructor not found');

    
    
    return this.sessionRepository.assignInstructor(sessionId, instructorId);
  }
}

export { AssignInstructorUseCase };
