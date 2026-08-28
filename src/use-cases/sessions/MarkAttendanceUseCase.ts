const SETTABLE_STATUSES = ['present', 'absent'];

class MarkAttendanceUseCase {
  sessionRepository: any;
  instructorRepository: any;

  constructor({ sessionRepository, instructorRepository }) {
    this.sessionRepository = sessionRepository;
    this.instructorRepository = instructorRepository;
  }

  async execute({ requester, sessionId, attendeeId, status }: { requester: any; sessionId: any; attendeeId: any; status: any }) {
    if (!SETTABLE_STATUSES.includes(status)) {
      throw new Error('status must be "present" or "absent"');
    }

    const session = await this.sessionRepository.findById(sessionId);
    if (!session) throw new Error('Training session not found');

    if (!requester.canManageCatalog() && !requester.isSuperAdmin()) {
      if (!requester.isInstructor()) {
        throw new Error('You are not allowed to mark attendance for this session');
      }
      const instructorProfile = await this.instructorRepository.findByUserId(requester.id);
      if (!instructorProfile || session.instructorId !== instructorProfile.id) {
        throw new Error('You are not allowed to mark attendance for this session');
      }
    }

    const attendee = await this.sessionRepository.findAttendeeById(attendeeId);
    if (!attendee || attendee.sessionId !== session.id) {
      throw new Error('Attendee not found for this session');
    }

    return this.sessionRepository.markAttendeeStatus(attendeeId, status);
  }
}

export { MarkAttendanceUseCase };
