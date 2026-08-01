class UpdateClientUseCase {
  clientRepository: any;
  auditLogRepository: any;

  constructor({ clientRepository, auditLogRepository }) {
    this.clientRepository = clientRepository;
    this.auditLogRepository = auditLogRepository;
  }

  async execute({ requester, clientId, companyName, email, phone }) {
    if (!requester.canManageCatalog() && !requester.isSuperAdmin()) {
      throw new Error('Only Sales or Manager can update a client');
    }

    const client = await this.clientRepository.findById(clientId);
    if (!client) {
      throw new Error('Client not found');
    }

    if (client.createdBy !== requester.id && !requester.isSuperAdmin()) {
      throw new Error('You can only update a client you created');
    }

    const updated = await this.clientRepository.update(clientId, { companyName, email, phone });

    await this.auditLogRepository.create({
      actorId: requester.id,
      action: 'update',
      entityType: 'Client',
      entityId: clientId,
      before: client,
      after: updated,
    });

    return updated;
  }
}

export { UpdateClientUseCase };
