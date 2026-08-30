import { isValidEmail } from '../../domain/validation/isValidEmail';

class UpdateAttendeeUseCase {
  sessionRepository: any;

  constructor({ sessionRepository }) {
    this.sessionRepository = sessionRepository;
  }

  async execute({
    requester,
    sessionId,
    attendeeId,
    name,
    email,
  }: {
    requester: any;
    sessionId: any;
    attendeeId: any;
    name: any;
    email?: any;
  }) {
    if (!requester.canManageCatalog()) {
      throw new Error('Only Sales or Manager can edit attendees for a session');
    }
    const session = await this.sessionRepository.findById(sessionId);
    if (!session) throw new Error('Training session not found');

    const attendee = await this.sessionRepository.findAttendeeById(attendeeId);
    if (!attendee || attendee.sessionId !== session.id) {
      throw new Error('Attendee not found for this session');
    }

    if (!name || !name.trim()) throw new Error('Attendee name is required');
    if (email && !isValidEmail(email)) throw new Error('email must be a valid email address');

    if (email) {
      const conflict = await this.sessionRepository.findOverlappingAttendeeSession({
        email,
        sessionId,
        startDate: session.startDate,
        endDate: session.endDate,
      });
      if (conflict) {
        throw new Error('This attendee is already registered in another session that overlaps this one');
      }
    }

    return this.sessionRepository.updateAttendee(attendeeId, { name: name.trim(), email });
  }
}

export { UpdateAttendeeUseCase };
