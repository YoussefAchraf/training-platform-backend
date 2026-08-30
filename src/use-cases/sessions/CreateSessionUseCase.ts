class CreateSessionUseCase {
  sessionRepository: any;
  trainingRepository: any;
  clientRepository: any;
  calendarRepository: any;
  auditLogRepository: any;

  constructor({ sessionRepository, trainingRepository, clientRepository, calendarRepository, auditLogRepository }) {
    this.sessionRepository = sessionRepository;
    this.trainingRepository = trainingRepository;
    this.clientRepository = clientRepository;
    this.calendarRepository = calendarRepository;
    this.auditLogRepository = auditLogRepository;
  }

  async execute({ requester, trainingId, clientId, startDate, endDate, includeWeekends = false }) {
    if (!requester.canManageCatalog()) {
      throw new Error('Only Sales or Manager can create a training session');
    }

    const training = await this.trainingRepository.findById(trainingId);
    if (!training) throw new Error('Training not found');

    const client = await this.clientRepository.findById(clientId);
    if (!client) throw new Error('Client not found');

    if (new Date(endDate) <= new Date(startDate)) {
      throw new Error('endDate must be after startDate');
    }

    const conflict = await this.sessionRepository.findConflictingSessionForTraining(trainingId, startDate);
    if (conflict) {
      throw new Error('Another session for this training already starts at the exact same time');
    }

    const session = await this.sessionRepository.create({
      trainingId,
      clientId,
      instructorId: null,
      startDate,
      endDate,
      includeWeekends,
      createdBy: requester.id,
    });

    await this.calendarRepository.create({
      sessionId: session.id,
      eventDate: startDate,
      endDate,
      title: `${training.name} - ${client.companyName}`,
    });

    await this.auditLogRepository.create({
      actorId: requester.id,
      action: 'create',
      entityType: 'Session',
      entityId: session.id,
      after: session,
    });

    return session;
  }
}

export { CreateSessionUseCase };
