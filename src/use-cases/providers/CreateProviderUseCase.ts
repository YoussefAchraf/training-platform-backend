class CreateProviderUseCase {
  providerRepository: any;
  auditLogRepository: any;

  constructor({ providerRepository, auditLogRepository }) {
    this.providerRepository = providerRepository;
    this.auditLogRepository = auditLogRepository;
  }

  async execute({ requester, name, description }) {
    if (!requester.canManageCatalog()) {
      throw new Error('Only Sales or Manager can add a provider');
    }
    if (!name || !name.trim()) {
      throw new Error('Provider name is required');
    }

    const existing = await this.providerRepository.findByName(name);
    if (existing) {
      throw new Error('A provider with this name already exists');
    }

    const provider = await this.providerRepository.create({ name: name.trim(), description });

    await this.auditLogRepository.create({
      actorId: requester.id,
      action: 'create',
      entityType: 'Provider',
      entityId: provider.id,
      after: provider,
    });

    return provider;
  }
}

export { CreateProviderUseCase };
