class ApproveUserUseCase {
  userRepository: any;
  emailService: any;
  refreshTokenStore: any;

  constructor({ userRepository, emailService, refreshTokenStore }) {
    this.userRepository = userRepository;
    this.emailService = emailService;
    this.refreshTokenStore = refreshTokenStore;
  }

  async execute({ managerUser, targetUserId, decision }) {
    if (!managerUser.isManager()) {
      throw new Error('Only a Manager can approve or reject account requests');
    }

    const targetUser = await this.userRepository.findById(targetUserId);
    if (!targetUser) {
      throw new Error('User not found');
    }

    if (decision === 'approve') {
      const updated = await this.userRepository.approve(targetUserId, managerUser.id);
      
      await this.emailService.sendAccountApprovedEmail(updated.email, updated.firstname);
      return updated.toSafeJSON();
    }

    if (decision === 'reject') {
      const updated = await this.userRepository.reject(targetUserId, managerUser.id);
      
      
      
      await this.refreshTokenStore.revokeAllForUser(targetUserId);
      await this.emailService.sendAccountRejectedEmail(updated.email, updated.firstname);
      return updated.toSafeJSON();
    }

    throw new Error("decision must be 'approve' or 'reject'");
  }
}

export { ApproveUserUseCase };
