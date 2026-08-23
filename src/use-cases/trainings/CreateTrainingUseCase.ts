class CreateTrainingUseCase {
  trainingRepository: any;
  providerRepository: any;
  auditLogRepository: any;

  constructor({ trainingRepository, providerRepository, auditLogRepository }) {
    this.trainingRepository = trainingRepository;
    this.providerRepository = providerRepository;
    this.auditLogRepository = auditLogRepository;
  }

  async execute({ requester, name, providerId, description, duration, durationUnit }) {
    if (!requester.canManageCatalog()) {
      throw new Error('Only Sales or Manager can create a training');
    }
    if (!name || !name.trim()) {
      throw new Error('Training name is required');
    }
    if (duration !== undefined && duration !== null && durationUnit !== 'days' && durationUnit !== 'hours') {
      throw new Error('durationUnit must be "days" or "hours" when duration is set');
    }

    const provider = await this.providerRepository.findById(providerId);
    if (!provider) {
      throw new Error('Provider not found');
    }

    const training = await this.trainingRepository.create({
      name: name.trim(),
      providerId,
      description,
      duration,
      durationUnit: duration !== undefined && duration !== null ? durationUnit : null,
      createdBy: requester.id,
    });

    await this.auditLogRepository.create({
      actorId: requester.id,
      action: 'create',
      entityType: 'Training',
      entityId: training.id,
      after: training,
    });

    return training;
  }
}

export { CreateTrainingUseCase };
