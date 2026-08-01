class DeleteClientUseCase {
  clientRepository: any;
  auditLogRepository: any;

  constructor({ clientRepository, auditLogRepository }) {
    this.clientRepository = clientRepository;
    this.auditLogRepository = auditLogRepository;
  }

  async execute({ requester, clientId }) {
    if (!requester.canManageCatalog() && !requester.isSuperAdmin()) {
      throw new Error('Only Sales or Manager can delete a client');
    }

    const client = await this.clientRepository.findById(clientId);
    if (!client) {
      throw new Error('Client not found');
    }

    if (client.createdBy !== requester.id && !requester.isSuperAdmin()) {
      throw new Error('You can only delete a client you created');
    }

    const deleted = await this.clientRepository.softDelete(clientId);

    await this.auditLogRepository.create({
      actorId: requester.id,
      action: 'delete',
      entityType: 'Client',
      entityId: clientId,
      before: client,
      after: deleted,
    });

    return deleted;
  }
}

export { DeleteClientUseCase };
