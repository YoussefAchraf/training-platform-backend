const MAX_BODY_LENGTH = 5000;

class CreateSessionNoteUseCase {
  sessionRepository: any;
  instructorRepository: any;
  sessionNoteRepository: any;

  constructor({ sessionRepository, instructorRepository, sessionNoteRepository }) {
    this.sessionRepository = sessionRepository;
    this.instructorRepository = instructorRepository;
    this.sessionNoteRepository = sessionNoteRepository;
  }

  async execute({ requester, sessionId, body }: { requester: any; sessionId: any; body: any }) {
    const session = await this.sessionRepository.findById(sessionId);
    if (!session) throw new Error('Training session not found');

    if (!requester.isInstructor()) {
      throw new Error('Only the assigned Instructor can add a note to this session');
    }
    const instructorProfile = await this.instructorRepository.findByUserId(requester.id);
    if (!instructorProfile || session.instructorId !== instructorProfile.id) {
      throw new Error('Only the assigned Instructor can add a note to this session');
    }

    const trimmed = (body || '').trim();
    if (!trimmed) throw new Error('Note body is required');
    if (trimmed.length > MAX_BODY_LENGTH) {
      throw new Error(`Note body must be at most ${MAX_BODY_LENGTH} characters`);
    }

    return this.sessionNoteRepository.create({
      sessionId: session.id,
      instructorId: instructorProfile.id,
      body: trimmed,
    });
  }
}

export { CreateSessionNoteUseCase };
