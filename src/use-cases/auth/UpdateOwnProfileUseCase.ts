class UpdateOwnProfileUseCase {
  userRepository: any;
  auditLogRepository: any;

  constructor({ userRepository, auditLogRepository }) {
    this.userRepository = userRepository;
    this.auditLogRepository = auditLogRepository;
  }

  async execute({
    requester,
    firstname,
    lastname,
    hasSeenTour,
  }: {
    requester: any;
    firstname?: any;
    lastname?: any;
    hasSeenTour?: boolean;
  }) {
    const before = requester.toSafeJSON();

    const updated = await this.userRepository.update(requester.id, { firstname, lastname, hasSeenTour });

    
    
    
    if (firstname !== undefined || lastname !== undefined) {
      await this.auditLogRepository.create({
        actorId: requester.id,
        action: 'update',
        entityType: 'User',
        entityId: requester.id,
        before,
        after: updated.toSafeJSON(),
      });
    }

    return updated.toSafeJSON();
  }
}

export { UpdateOwnProfileUseCase };
