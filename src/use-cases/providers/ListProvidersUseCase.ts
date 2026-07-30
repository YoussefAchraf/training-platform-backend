class ListProvidersUseCase {
  providerRepository: any;

  constructor({ providerRepository }) {
    this.providerRepository = providerRepository;
  }

  async execute() {
    return this.providerRepository.listAll();
  }
}

export { ListProvidersUseCase };
