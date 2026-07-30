class ListTrainingsUseCase {
  trainingRepository: any;

  constructor({ trainingRepository }) {
    this.trainingRepository = trainingRepository;
  }

  async execute({ providerId }: any = {}) {
    if (providerId) {
      return this.trainingRepository.listByProvider(providerId);
    }
    return this.trainingRepository.listAll();
  }
}

export { ListTrainingsUseCase };
