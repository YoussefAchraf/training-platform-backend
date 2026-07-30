class ListClientsUseCase {
  clientRepository: any;

  constructor({ clientRepository }) {
    this.clientRepository = clientRepository;
  }

  async execute() {
    return this.clientRepository.listAll();
  }
}

export { ListClientsUseCase };
