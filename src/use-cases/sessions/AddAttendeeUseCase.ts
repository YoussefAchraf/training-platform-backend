import { isValidEmail } from '../../domain/validation/isValidEmail';

class AddAttendeeUseCase {
  sessionRepository: any;

  constructor({ sessionRepository }) {
    this.sessionRepository = sessionRepository;
  }

  async execute({ requester, sessionId, name, email }) {
    if (!requester.canManageCatalog()) {
      throw new Error('Only Sales or Manager can register attendees for a session');
    }
    const session = await this.sessionRepository.findById(sessionId);
    if (!session) throw new Error('Training session not found');
    if (!name || !name.trim()) throw new Error('Attendee name is required');
    if (email && !isValidEmail(email)) throw new Error('email must be a valid email address');

    return this.sessionRepository.addAttendee(sessionId, { name: name.trim(), email });
  }
}

export { AddAttendeeUseCase };
