class DeleteSessionNoteUseCase {
  sessionRepository: any;
  instructorRepository: any;
  sessionNoteRepository: any;

  constructor({ sessionRepository, instructorRepository, sessionNoteRepository }) {
    this.sessionRepository = sessionRepository;
    this.instructorRepository = instructorRepository;
    this.sessionNoteRepository = sessionNoteRepository;
  }

  async execute({ requester, sessionId, noteId }: { requester: any; sessionId: any; noteId: any }) {
    const session = await this.sessionRepository.findById(sessionId);
    if (!session) throw new Error('Training session not found');

    if (!requester.isInstructor()) {
      throw new Error('Only the note author can delete this note');
    }
    const instructorProfile = await this.instructorRepository.findByUserId(requester.id);
    if (!instructorProfile || session.instructorId !== instructorProfile.id) {
      throw new Error('Only the note author can delete this note');
    }

    const note = await this.sessionNoteRepository.findById(noteId);
    if (!note || note.sessionId !== session.id) {
      throw new Error('Note not found for this session');
    }
    if (note.instructorId !== instructorProfile.id) {
      throw new Error('Only the note author can delete this note');
    }

    await this.sessionNoteRepository.delete(noteId);
  }
}

export { DeleteSessionNoteUseCase };
