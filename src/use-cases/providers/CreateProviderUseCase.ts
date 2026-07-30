class CreateProviderUseCase {
  providerRepository: any;

  constructor({ providerRepository }) {
    this.providerRepository = providerRepository;
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

    return this.providerRepository.create({ name: name.trim(), description });
  }
}

export { CreateProviderUseCase };
