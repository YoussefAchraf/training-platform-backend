class UpdateClientUseCase {
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

    try {
      const managers = await this.userRepository.listApprovedManagers();
      await this.emailService.sendRecordChangedNotification(
        managers.filter((m) => m.email !== requester.email).map((m) => m.email),
        { actor: requester, action: 'update', entityType: 'Client', entityId: clientId, label: updated.companyName }
      );
    } catch (err) {
      console.error('Failed to send manager notification:', err.message);
    }

    return updated;
  }
}

export { UpdateClientUseCase };
