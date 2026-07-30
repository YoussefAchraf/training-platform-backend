class CreateClientUseCase {
  clientRepository: any;

  constructor({ clientRepository }) {
    this.clientRepository = clientRepository;
  }

  async execute({ requester, companyName, email, phone }) {
    if (!requester.canManageCatalog()) {
      throw new Error('Only Sales or Manager can add a client');
    }
    if (!companyName || !companyName.trim()) {
      throw new Error('Company name is required');
    }

    return this.clientRepository.create({
      companyName: companyName.trim(),
      email,
      phone,
      createdBy: requester.id,
    });
  }
}

export { CreateClientUseCase };
