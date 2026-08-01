class DeleteTrainingUseCase {
  trainingRepository: any;
  auditLogRepository: any;

  constructor({ trainingRepository, auditLogRepository }) {
    this.trainingRepository = trainingRepository;
    this.auditLogRepository = auditLogRepository;
  }

  async execute({ requester, trainingId }) {
    if (!requester.canManageCatalog() && !requester.isSuperAdmin()) {
      throw new Error('Only Sales or Manager can delete a training');
    }

    const training = await this.trainingRepository.findById(trainingId);
    if (!training) {
      throw new Error('Training not found');
    }

    if (training.createdBy !== requester.id && !requester.isSuperAdmin()) {
      throw new Error('You can only delete a training you created');
    }

    const deleted = await this.trainingRepository.softDelete(trainingId);

    await this.auditLogRepository.create({
      actorId: requester.id,
      action: 'delete',
      entityType: 'Training',
      entityId: trainingId,
      before: training,
      after: deleted,
    });

    return deleted;
  }
}

export { DeleteTrainingUseCase };
