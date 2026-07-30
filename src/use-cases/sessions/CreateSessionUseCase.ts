class CreateSessionUseCase {
  sessionRepository: any;
  trainingRepository: any;
  clientRepository: any;
  calendarRepository: any;

  constructor({ sessionRepository, trainingRepository, clientRepository, calendarRepository }) {
    this.sessionRepository = sessionRepository;
    this.trainingRepository = trainingRepository;
    this.clientRepository = clientRepository;
    this.calendarRepository = calendarRepository;
  }

  async execute({ requester, trainingId, clientId, startDate, endDate }) {
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

    const session = await this.sessionRepository.create({
      trainingId,
      clientId,
      instructorId: null,
      startDate,
      endDate,
      createdBy: requester.id,
    });

    
    await this.calendarRepository.create({
      sessionId: session.id,
      eventDate: startDate,
      title: `${training.name} - ${client.companyName}`,
    });

    return session;
  }
}

export { CreateSessionUseCase };
