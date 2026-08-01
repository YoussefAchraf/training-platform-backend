class DeleteTrainingUseCase {
  trainingRepository: any;
  auditLogRepository: any;
  userRepository: any;
  emailService: any;

  constructor({ trainingRepository, auditLogRepository, userRepository, emailService }) {
    this.trainingRepository = trainingRepository;
    this.auditLogRepository = auditLogRepository;
    this.userRepository = userRepository;
    this.emailService = emailService;
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

    try {
      const managers = await this.userRepository.listApprovedManagers();
      await this.emailService.sendRecordChangedNotification(
        managers.filter((m) => m.email !== requester.email).map((m) => m.email),
        { actor: requester, action: 'delete', entityType: 'Training', entityId: trainingId, label: training.name }
      );
    } catch (err) {
      console.error('Failed to send manager notification:', err.message);
    }

    return deleted;
  }
}

export { DeleteTrainingUseCase };
