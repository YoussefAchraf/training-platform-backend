import { ASSIGNMENT_STATUS } from '../../domain/entities/TrainingSession';

class RespondToAssignmentUseCase {
  sessionRepository: any;
  instructorRepository: any;

  constructor({ sessionRepository, instructorRepository }) {
    this.sessionRepository = sessionRepository;
    this.instructorRepository = instructorRepository;
  }

  async execute({ requester, sessionId, decision }) {
    if (!requester.isInstructor()) {
      throw new Error('Only an Instructor can accept or refuse a session assignment');
    }
    if (!['accept', 'refuse'].includes(decision)) {
      throw new Error("decision must be 'accept' or 'refuse'");
    }

    const session = await this.sessionRepository.findById(sessionId);
    if (!session) throw new Error('Training session not found');

    const instructorProfile = await this.instructorRepository.findByUserId(requester.id);
    if (!instructorProfile || session.instructorId !== instructorProfile.id) {
      throw new Error('This session is not assigned to you');
    }

    const newStatus = decision === 'accept' ? ASSIGNMENT_STATUS.ACCEPTED : ASSIGNMENT_STATUS.REFUSED;
    return this.sessionRepository.updateAssignmentStatus(sessionId, newStatus);
  }
}

export { RespondToAssignmentUseCase };
