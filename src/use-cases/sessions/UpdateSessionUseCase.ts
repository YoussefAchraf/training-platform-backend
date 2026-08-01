class UpdateSessionUseCase {
  sessionRepository: any;
  reportRepository: any;
  surveyRepository: any;
  auditLogRepository: any;
  userRepository: any;
  emailService: any;

  constructor({ sessionRepository, reportRepository, surveyRepository, auditLogRepository, userRepository, emailService }) {
    this.sessionRepository = sessionRepository;
    this.reportRepository = reportRepository;
    this.surveyRepository = surveyRepository;
    this.auditLogRepository = auditLogRepository;
    this.userRepository = userRepository;
    this.emailService = emailService;
  }

  async execute({ requester, sessionId, startDate, endDate }) {
    if (!requester.canManageCatalog() && !requester.isSuperAdmin()) {
      throw new Error('Only Sales or Manager can update a training session');
    }

    const session = await this.sessionRepository.findById(sessionId);
    if (!session) {
      throw new Error('Training session not found');
    }

    if (session.createdBy !== requester.id && !requester.isSuperAdmin()) {
      throw new Error('You can only update a training session you created');
    }

    if (!requester.isSuperAdmin()) {
      const [report, surveys] = await Promise.all([
        this.reportRepository.findBySessionId(sessionId),
        this.surveyRepository.listBySession(sessionId),
      ]);
      if (report || surveys.length > 0) {
        throw new Error('Cannot edit a session that already has a survey or report');
      }
    }

    const nextStartDate = startDate || session.startDate;
    const nextEndDate = endDate || session.endDate;
    if (new Date(nextEndDate) <= new Date(nextStartDate)) {
      throw new Error('endDate must be after startDate');
    }

    const updated = await this.sessionRepository.update(sessionId, { startDate, endDate });

    await this.auditLogRepository.create({
      actorId: requester.id,
      action: 'update',
      entityType: 'Session',
      entityId: sessionId,
      before: session,
      after: updated,
    });

    try {
      const managers = await this.userRepository.listApprovedManagers();
      await this.emailService.sendRecordChangedNotification(
        managers.filter((m) => m.email !== requester.email).map((m) => m.email),
        { actor: requester, action: 'update', entityType: 'Session', entityId: sessionId }
      );
    } catch (err) {
      console.error('Failed to send manager notification:', err.message);
    }

    return updated;
  }
}

export { UpdateSessionUseCase };
