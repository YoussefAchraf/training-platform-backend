class UpdateProviderUseCase {
  providerRepository: any;
  auditLogRepository: any;

  constructor({ providerRepository, auditLogRepository }) {
    this.providerRepository = providerRepository;
    this.auditLogRepository = auditLogRepository;
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

    return updated;
  }
}

export { UpdateProviderUseCase };
