class ListSessionNotesUseCase {
  sessionRepository: any;
  instructorRepository: any;
  sessionNoteRepository: any;

  constructor({ sessionRepository, instructorRepository, sessionNoteRepository }) {
    this.sessionRepository = sessionRepository;
    this.instructorRepository = instructorRepository;
    this.sessionNoteRepository = sessionNoteRepository;
  }

  async execute({ requester, sessionId }: { requester: any; sessionId: any }) {
    const session = await this.sessionRepository.findById(sessionId);
    if (!session) throw new Error('Training session not found');

    if (!requester.canManageCatalog() && !requester.isSuperAdmin()) {
      if (!requester.isInstructor()) {
        throw new Error("You are not allowed to view this session's notes");
      }
      const instructorProfile = await this.instructorRepository.findByUserId(requester.id);
      if (!instructorProfile || session.instructorId !== instructorProfile.id) {
        throw new Error("You are not allowed to view this session's notes");
      }
    }

    return this.sessionNoteRepository.listBySessionId(sessionId);
  }
}

export { ListSessionNotesUseCase };
