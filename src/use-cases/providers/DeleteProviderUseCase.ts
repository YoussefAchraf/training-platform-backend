class DeleteProviderUseCase {
  providerRepository: any;
  auditLogRepository: any;

  constructor({ providerRepository, auditLogRepository }) {
    this.providerRepository = providerRepository;
    this.auditLogRepository = auditLogRepository;
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

    return deleted;
  }
}

export { DeleteProviderUseCase };
