class RequestPasswordResetUseCase {
  userRepository: any;
  passwordResetTokenStore: any;
  refreshTokenStore: any;
  emailService: any;
  auditLogRepository: any;

  constructor({ userRepository, passwordResetTokenStore, refreshTokenStore, emailService, auditLogRepository }) {
    this.userRepository = userRepository;
    this.passwordResetTokenStore = passwordResetTokenStore;
    this.refreshTokenStore = refreshTokenStore;
    this.emailService = emailService;
    this.auditLogRepository = auditLogRepository;
  }

  async execute({ requester, targetUserId }: { requester: any; targetUserId: any }) {
    if (!requester.isSuperAdmin()) {
      throw new Error('Only a SuperAdmin can send a password reset');
    }

    const target = await this.userRepository.findById(targetUserId);
    if (!target) {
      throw new Error('User not found');
    }

    if (target.isSuperAdmin()) {
      throw new Error('Cannot send a password reset for a SuperAdmin account');
    }

    const token = await this.passwordResetTokenStore.issue(target.id);
    await this.refreshTokenStore.revokeAllForUser(target.id);

    const resetUrl = `${process.env.CLIENT_URL}/reset-password?token=${token}`;
    await this.emailService.sendPasswordResetEmail(target.email, target.firstname, resetUrl);

    await this.auditLogRepository.create({
      actorId: requester.id,
      action: 'password-reset-requested',
      entityType: 'User',
      entityId: target.id,
      after: { email: target.email },
    });

    return { message: 'Password reset email sent.' };
  }
}

export { RequestPasswordResetUseCase };
