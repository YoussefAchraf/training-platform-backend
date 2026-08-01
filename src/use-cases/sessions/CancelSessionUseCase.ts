import { SESSION_STATUS } from '../../domain/entities/TrainingSession';

class CancelSessionUseCase {
  sessionRepository: any;
  reportRepository: any;
  surveyRepository: any;
  auditLogRepository: any;

  constructor({ sessionRepository, reportRepository, surveyRepository, auditLogRepository }) {
    this.sessionRepository = sessionRepository;
    this.reportRepository = reportRepository;
    this.surveyRepository = surveyRepository;
    this.auditLogRepository = auditLogRepository;
  }

  async execute({ requester, sessionId }) {
    if (!requester.canManageCatalog() && !requester.isSuperAdmin()) {
      throw new Error('Only Sales or Manager can cancel a training session');
    }

    const session = await this.sessionRepository.findById(sessionId);
    if (!session) {
      throw new Error('Training session not found');
    }

    if (session.createdBy !== requester.id && !requester.isSuperAdmin()) {
      throw new Error('You can only cancel a training session you created');
    }

    if (session.sessionStatus === SESSION_STATUS.CANCELLED) {
      throw new Error('Training session is already cancelled');
    }

    if (!requester.isSuperAdmin()) {
      const [report, surveys] = await Promise.all([
        this.reportRepository.findBySessionId(sessionId),
        this.surveyRepository.listBySession(sessionId),
      ]);
      if (report || surveys.length > 0) {
        throw new Error('Cannot cancel a session that already has a survey or report');
      }
    }

    const updated = await this.sessionRepository.updateSessionStatus(sessionId, SESSION_STATUS.CANCELLED);

    await this.auditLogRepository.create({
      actorId: requester.id,
      action: 'cancel',
      entityType: 'Session',
      entityId: sessionId,
      before: session,
      after: updated,
    });

    return updated;
  }
}

export { CancelSessionUseCase };
