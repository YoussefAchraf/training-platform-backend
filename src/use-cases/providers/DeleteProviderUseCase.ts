class DeleteProviderUseCase {
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

  async execute({ requester, providerId }) {
    if (!requester.canManageCatalog() && !requester.isSuperAdmin()) {
      throw new Error('Only Sales or Manager can delete a provider');
    }

    const provider = await this.providerRepository.findById(providerId);
    if (!provider) {
      throw new Error('Provider not found');
    }

    if (provider.createdBy !== requester.id && !requester.isSuperAdmin()) {
      throw new Error('You can only delete a provider you created');
    }

    const deleted = await this.providerRepository.softDelete(providerId);

    await this.auditLogRepository.create({
      actorId: requester.id,
      action: 'delete',
      entityType: 'Provider',
      entityId: providerId,
      before: provider,
      after: deleted,
    });

    try {
      const managers = await this.userRepository.listApprovedManagers();
      await this.emailService.sendRecordChangedNotification(
        managers.filter((m) => m.email !== requester.email).map((m) => m.email),
        { actor: requester, action: 'delete', entityType: 'Provider', entityId: providerId, label: provider.name }
      );
    } catch (err) {
      console.error('Failed to send manager notification:', err.message);
    }

    return deleted;
  }
}

export { DeleteProviderUseCase };
