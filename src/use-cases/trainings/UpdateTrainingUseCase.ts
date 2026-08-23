class UpdateTrainingUseCase {
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

  async execute({ requester, trainingId, name, description, duration, durationUnit }: { requester: any; trainingId: any; name: any; description?: any; duration?: any; durationUnit?: any }) {
    if (!requester.canManageCatalog() && !requester.isSuperAdmin()) {
      throw new Error('Only Sales or Manager can update a training');
    }
    if (durationUnit !== undefined && durationUnit !== null && durationUnit !== 'days' && durationUnit !== 'hours') {
      throw new Error('durationUnit must be "days" or "hours"');
    }

    const training = await this.trainingRepository.findById(trainingId);
    if (!training) {
      throw new Error('Training not found');
    }

    if (training.createdBy !== requester.id && !requester.isSuperAdmin()) {
      throw new Error('You can only update a training you created');
    }

    const updated = await this.trainingRepository.update(trainingId, { name, description, duration, durationUnit });

    await this.auditLogRepository.create({
      actorId: requester.id,
      action: 'update',
      entityType: 'Training',
      entityId: trainingId,
      before: training,
      after: updated,
    });

    try {
      const managers = await this.userRepository.listApprovedManagers();
      await this.emailService.sendRecordChangedNotification(
        managers.filter((m) => m.email !== requester.email).map((m) => m.email),
        { actor: requester, action: 'update', entityType: 'Training', entityId: trainingId, label: updated.name }
      );
    } catch (err) {
      console.error('Failed to send manager notification:', err.message);
    }

    return updated;
  }
}

export { UpdateTrainingUseCase };
