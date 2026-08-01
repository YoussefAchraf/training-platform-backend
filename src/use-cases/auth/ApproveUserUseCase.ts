class ApproveUserUseCase {
  userRepository: any;
  emailService: any;
  refreshTokenStore: any;
  auditLogRepository: any;

  constructor({ userRepository, emailService, refreshTokenStore, auditLogRepository }) {
    this.userRepository = userRepository;
    this.emailService = emailService;
    this.refreshTokenStore = refreshTokenStore;
    this.auditLogRepository = auditLogRepository;
  }

  async execute({ managerUser, targetUserId, decision }) {
    if (!managerUser.isManager() && !managerUser.isSuperAdmin()) {
      throw new Error('Only a Manager can approve or reject account requests');
    }

    const targetUser = await this.userRepository.findById(targetUserId);
    if (!targetUser) {
      throw new Error('User not found');
    }

    if (decision === 'approve') {
      const updated = await this.userRepository.approve(targetUserId, managerUser.id);
      await this.auditLogRepository.create({
        actorId: managerUser.id,
        action: 'approve',
        entityType: 'User',
        entityId: targetUserId,
        before: targetUser.toSafeJSON(),
        after: updated.toSafeJSON(),
      });
      try {
        await this.emailService.sendAccountApprovedEmail(updated.email, updated.firstname);
      } catch (err) {
        console.error('Failed to send account-approved email:', err.message);
      }
      return updated.toSafeJSON();
    }

    if (decision === 'reject') {
      const updated = await this.userRepository.reject(targetUserId, managerUser.id);
      await this.auditLogRepository.create({
        actorId: managerUser.id,
        action: 'reject',
        entityType: 'User',
        entityId: targetUserId,
        before: targetUser.toSafeJSON(),
        after: updated.toSafeJSON(),
      });
      await this.refreshTokenStore.revokeAllForUser(targetUserId);
      try {
        await this.emailService.sendAccountRejectedEmail(updated.email, updated.firstname);
      } catch (err) {
        console.error('Failed to send account-rejected email:', err.message);
      }
      return updated.toSafeJSON();
    }

    throw new Error("decision must be 'approve' or 'reject'");
  }
}

export { ApproveUserUseCase };
