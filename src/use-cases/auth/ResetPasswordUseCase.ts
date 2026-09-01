import { isValidPassword } from '../../domain/validation/isValidPassword';

class ResetPasswordUseCase {
  userRepository: any;
  passwordResetTokenStore: any;
  refreshTokenStore: any;
  passwordHasher: any;
  emailService: any;
  auditLogRepository: any;

  constructor({ userRepository, passwordResetTokenStore, refreshTokenStore, passwordHasher, emailService, auditLogRepository }) {
    this.userRepository = userRepository;
    this.passwordResetTokenStore = passwordResetTokenStore;
    this.refreshTokenStore = refreshTokenStore;
    this.passwordHasher = passwordHasher;
    this.emailService = emailService;
    this.auditLogRepository = auditLogRepository;
  }

  async execute({ token, newPassword }: { token: any; newPassword: any }) {
    if (!isValidPassword(newPassword)) {
      throw new Error('Password must be at least 10 characters and include a letter and a number');
    }

    const userId = await this.passwordResetTokenStore.consume(token);
    if (!userId) {
      throw new Error('This reset link is invalid or has expired');
    }

    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new Error('This reset link is invalid or has expired');
    }

    const passwordHash = await this.passwordHasher.hash(newPassword);
    await this.userRepository.update(userId, { passwordHash });
    await this.refreshTokenStore.revokeAllForUser(userId);

    await this.auditLogRepository.create({
      actorId: userId,
      action: 'password-reset-completed',
      entityType: 'User',
      entityId: userId,
    });

    try {
      await this.emailService.sendPasswordChangedEmail(user.email, user.firstname);
    } catch (err) {
      console.error('Failed to send password-changed confirmation email:', err.message);
    }

    return { message: 'Password updated. You can now log in.' };
  }
}

export { ResetPasswordUseCase };
