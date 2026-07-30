class ListSessionsUseCase {
  sessionRepository: any;
  instructorRepository: any;

  constructor({ sessionRepository, instructorRepository }) {
    this.sessionRepository = sessionRepository;
    this.instructorRepository = instructorRepository;
  }

  async execute({ requester }) {
    
    
    if (requester.isInstructor()) {
      const instructorProfile = await this.instructorRepository.findByUserId(requester.id);
      if (!instructorProfile) return [];
      return this.sessionRepository.listByInstructor(instructorProfile.id);
    }
    return this.sessionRepository.listAll();
  }
}

export { ListSessionsUseCase };
