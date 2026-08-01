import { isValidEmail } from '../../domain/validation/isValidEmail';

class CreateClientUseCase {
  clientRepository: any;
  auditLogRepository: any;

  constructor({ clientRepository, auditLogRepository }) {
    this.clientRepository = clientRepository;
    this.auditLogRepository = auditLogRepository;
  }

  async execute({ requester, companyName, email, phone }) {
    if (!requester.canManageCatalog()) {
      throw new Error('Only Sales or Manager can add a client');
    }
    if (!companyName || !companyName.trim()) {
      throw new Error('Company name is required');
    }
    if (email && !isValidEmail(email)) {
      throw new Error('email must be a valid email address');
    }

    const client = await this.clientRepository.create({
      companyName: companyName.trim(),
      email,
      phone,
      createdBy: requester.id,
    });

    await this.auditLogRepository.create({
      actorId: requester.id,
      action: 'create',
      entityType: 'Client',
      entityId: client.id,
      after: client,
    });

    return client;
  }
}

export { CreateClientUseCase };
