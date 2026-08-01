class UpdateProviderUseCase {
  providerRepository: any;
  auditLogRepository: any;
  userRepository: any;
  emailService: any;

  constructor({ providerRepository, auditLogRepository, userRepository, emailService }) {
    this.providerRepository = providerRepository;
    this.auditLogRepository = auditLogRepository;
    this.userRepository = userRepository;
    this.emailService = emailService;
  }

  async execute({ requester, providerId, name, description }) {
    if (!requester.canManageCatalog() && !requester.isSuperAdmin()) {
      throw new Error('Only Sales or Manager can update a provider');
    }

    const provider = await this.providerRepository.findById(providerId);
    if (!provider) {
      throw new Error('Provider not found');
    }

    if (provider.createdBy !== requester.id && !requester.isSuperAdmin()) {
      throw new Error('You can only update a provider you created');
    }

    const updated = await this.providerRepository.update(providerId, { name, description });

    await this.auditLogRepository.create({
      actorId: requester.id,
      action: 'update',
      entityType: 'Provider',
      entityId: providerId,
      before: provider,
      after: updated,
    });

    try {
      const managers = await this.userRepository.listApprovedManagers();
      await this.emailService.sendRecordChangedNotification(
        managers.filter((m) => m.email !== requester.email).map((m) => m.email),
        { actor: requester, action: 'update', entityType: 'Provider', entityId: providerId, label: updated.name }
      );
    } catch (err) {
      console.error('Failed to send manager notification:', err.message);
    }

    return updated;
  }
}

export { UpdateProviderUseCase };
