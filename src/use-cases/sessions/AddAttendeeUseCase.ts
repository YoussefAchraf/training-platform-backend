import { isValidEmail } from '../../domain/validation/isValidEmail';

class AddAttendeeUseCase {
  sessionRepository: any;

  constructor({ sessionRepository }) {
    this.sessionRepository = sessionRepository;
  }

  async execute({ requester, sessionId, name, email }: { requester: any; sessionId: any; name: any; email?: any }) {
    if (!requester.canManageCatalog()) {
      throw new Error('Only Sales or Manager can register attendees for a session');
    }
    const session = await this.sessionRepository.findById(sessionId);
    if (!session) throw new Error('Training session not found');
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

    return this.sessionRepository.addAttendee(sessionId, { name: name.trim(), email });
  }
}

export { AddAttendeeUseCase };
