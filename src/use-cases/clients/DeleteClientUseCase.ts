class DeleteClientUseCase {
  clientRepository: any;
  auditLogRepository: any;
  userRepository: any;
  emailService: any;

  constructor({ clientRepository, auditLogRepository, userRepository, emailService }) {
    this.clientRepository = clientRepository;
    this.auditLogRepository = auditLogRepository;
    this.userRepository = userRepository;
    this.emailService = emailService;
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

    try {
      const managers = await this.userRepository.listApprovedManagers();
      await this.emailService.sendRecordChangedNotification(
        managers.filter((m) => m.email !== requester.email).map((m) => m.email),
        { actor: requester, action: 'delete', entityType: 'Client', entityId: clientId, label: client.companyName }
      );
    } catch (err) {
      console.error('Failed to send manager notification:', err.message);
    }

    return deleted;
  }
}

export { DeleteClientUseCase };
