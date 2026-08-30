class DeleteAttendeeUseCase {
  sessionRepository: any;

  constructor({ sessionRepository }) {
    this.sessionRepository = sessionRepository;
  }

  async execute({ requester, sessionId, attendeeId }: { requester: any; sessionId: any; attendeeId: any }) {
    if (!requester.canManageCatalog()) {
      throw new Error('Only Sales, Manager, or SuperAdmin can remove attendees from a session');
    }

    const session = await this.sessionRepository.findById(sessionId);
    if (!session) throw new Error('Training session not found');

    const attendee = await this.sessionRepository.findAttendeeById(attendeeId);
    if (!attendee || attendee.sessionId !== session.id) {
      throw new Error('Attendee not found for this session');
    }

    if (attendee.surveySubmitted) {
      throw new Error('Cannot remove an attendee who has already submitted a survey');
    }

    await this.sessionRepository.deleteAttendee(attendeeId);
  }
}

export { DeleteAttendeeUseCase };
