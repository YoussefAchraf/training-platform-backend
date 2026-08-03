class UpdateOwnProfileUseCase {
  userRepository: any;
  auditLogRepository: any;

  constructor({ userRepository, auditLogRepository }) {
    this.userRepository = userRepository;
    this.auditLogRepository = auditLogRepository;
  }

  async execute({ requester, firstname, lastname }: { requester: any; firstname?: any; lastname?: any }) {
    const before = requester.toSafeJSON();

    const updated = await this.userRepository.update(requester.id, { firstname, lastname });

    await this.auditLogRepository.create({
      actorId: requester.id,
      action: 'update',
      entityType: 'User',
      entityId: requester.id,
      before,
      after: updated.toSafeJSON(),
    });

    return updated.toSafeJSON();
  }
}

export { UpdateOwnProfileUseCase };
