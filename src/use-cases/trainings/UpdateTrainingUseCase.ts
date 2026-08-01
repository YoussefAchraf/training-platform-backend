class UpdateTrainingUseCase {
  trainingRepository: any;
  auditLogRepository: any;

  constructor({ trainingRepository, auditLogRepository }) {
    this.trainingRepository = trainingRepository;
    this.auditLogRepository = auditLogRepository;
  }

  async execute({ requester, trainingId, name, description, duration }) {
    if (!requester.canManageCatalog() && !requester.isSuperAdmin()) {
      throw new Error('Only Sales or Manager can update a training');
    }

    const training = await this.trainingRepository.findById(trainingId);
    if (!training) {
      throw new Error('Training not found');
    }

    if (training.createdBy !== requester.id && !requester.isSuperAdmin()) {
      throw new Error('You can only update a training you created');
    }

    const updated = await this.trainingRepository.update(trainingId, { name, description, duration });

    await this.auditLogRepository.create({
      actorId: requester.id,
      action: 'update',
      entityType: 'Training',
      entityId: trainingId,
      before: training,
      after: updated,
    });

    return updated;
  }
}

export { UpdateTrainingUseCase };
