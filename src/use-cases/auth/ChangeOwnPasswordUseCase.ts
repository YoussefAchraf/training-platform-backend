import { isValidPassword } from '../../domain/validation/isValidPassword';

class ChangeOwnPasswordUseCase {
  userRepository: any;
  passwordHasher: any;
  tokenService: any;
  refreshTokenStore: any;
  emailService: any;
  auditLogRepository: any;

  constructor({ userRepository, passwordHasher, tokenService, refreshTokenStore, emailService, auditLogRepository }) {
    this.userRepository = userRepository;
    this.passwordHasher = passwordHasher;
    this.tokenService = tokenService;
    this.refreshTokenStore = refreshTokenStore;
    this.emailService = emailService;
    this.auditLogRepository = auditLogRepository;
  }

  async execute({ requester, currentPassword, newPassword }: { requester: any; currentPassword: any; newPassword: any }) {
    const user = await this.userRepository.findById(requester.id);
    if (!user) {
      throw new Error('User not found');
    }

    const currentMatches = await this.passwordHasher.compare(currentPassword || '', user.passwordHash);
    if (!currentMatches) {
      throw new Error('Current password is incorrect');
    }

    if (!isValidPassword(newPassword)) {
      throw new Error('Password must be at least 10 characters and include a letter and a number');
    }

    if (currentPassword === newPassword) {
      throw new Error('New password must be different from your current password');
    }

    const passwordHash = await this.passwordHasher.hash(newPassword);
    await this.userRepository.update(user.id, { passwordHash });

    await this.refreshTokenStore.revokeAllForUser(user.id);
    const accessToken = this.tokenService.signAccessToken({ userId: user.id, role: user.roleName });
    const refreshToken = await this.refreshTokenStore.issue(user.id);

    await this.auditLogRepository.create({
      actorId: user.id,
      action: 'change-password',
      entityType: 'User',
      entityId: user.id,
    });

    try {
      await this.emailService.sendPasswordChangedEmail(user.email, user.firstname);
    } catch (err) {
      console.error('Failed to send password-changed confirmation email:', err.message);
    }

    return { accessToken, refreshToken };
  }
}

export { ChangeOwnPasswordUseCase };
