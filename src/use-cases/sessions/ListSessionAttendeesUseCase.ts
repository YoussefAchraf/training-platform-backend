class ListSessionAttendeesUseCase {
  sessionRepository: any;
  instructorRepository: any;

  constructor({ sessionRepository, instructorRepository }: any) {
    this.sessionRepository = sessionRepository;
    this.instructorRepository = instructorRepository;
  }

  async execute({ requester, sessionId }: { requester: any; sessionId: any }) {
    const session = await this.sessionRepository.findById(sessionId);
    if (!session) throw new Error('Training session not found');

    if (!requester.canManageCatalog() && !requester.isSuperAdmin()) {
      if (!requester.isInstructor()) {
        throw new Error('You are not allowed to view this session\'s attendees');
      }
      const instructorProfile = await this.instructorRepository.findByUserId(requester.id);
      if (!instructorProfile || session.instructorId !== instructorProfile.id) {
        throw new Error('You are not allowed to view this session\'s attendees');
      }
    }

    return this.sessionRepository.listAttendees(sessionId);
  }
}

export { ListSessionAttendeesUseCase };
