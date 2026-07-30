class CreateTrainingUseCase {
  trainingRepository: any;
  providerRepository: any;

  constructor({ trainingRepository, providerRepository }) {
    this.trainingRepository = trainingRepository;
    this.providerRepository = providerRepository;
  }

  async execute({ requester, name, providerId, description, duration }) {
    if (!requester.canManageCatalog()) {
      throw new Error('Only Sales or Manager can create a training');
    }
    if (!name || !name.trim()) {
      throw new Error('Training name is required');
    }

    const provider = await this.providerRepository.findById(providerId);
    if (!provider) {
      throw new Error('Provider not found');
    }

    return this.trainingRepository.create({
      name: name.trim(),
      providerId,
      description,
      duration,
      createdBy: requester.id,
    });
  }
}

export { CreateTrainingUseCase };
