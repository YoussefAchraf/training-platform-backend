import { ResetPasswordUseCase } from '../../../src/use-cases/auth/ResetPasswordUseCase';

function buildDeps() {
  return {
    userRepository: {
      findById: jest.fn().mockResolvedValue({ id: 5, email: 'target@example.com', firstname: 'Target' }),
      update: jest.fn().mockResolvedValue(undefined),
    },
    passwordResetTokenStore: { consume: jest.fn().mockResolvedValue(5) },
    refreshTokenStore: { revokeAllForUser: jest.fn() },
    passwordHasher: { hash: jest.fn().mockResolvedValue('hashed-password') },
    emailService: { sendPasswordChangedEmail: jest.fn() },
    auditLogRepository: { create: jest.fn() },
  };
}

const VALID_PASSWORD = 'newpassword123';

describe('ResetPasswordUseCase', () => {
  it('rejects a weak new password before touching the token', async () => {
    const deps = buildDeps();
    const useCase = new ResetPasswordUseCase(deps);

    await expect(useCase.execute({ token: 'abc', newPassword: 'short1' })).rejects.toThrow('at least 10 characters');
    expect(deps.passwordResetTokenStore.consume).not.toHaveBeenCalled();
  });

  it('rejects an invalid, expired, or already-used token', async () => {
    const deps = buildDeps();
    deps.passwordResetTokenStore.consume.mockResolvedValue(null);
    const useCase = new ResetPasswordUseCase(deps);

    await expect(useCase.execute({ token: 'bad-token', newPassword: VALID_PASSWORD })).rejects.toThrow('invalid or has expired');
    expect(deps.userRepository.update).not.toHaveBeenCalled();
  });

  it('rejects when the token resolves to a user that no longer exists', async () => {
    const deps = buildDeps();
    deps.userRepository.findById.mockResolvedValue(null);
    const useCase = new ResetPasswordUseCase(deps);

    await expect(useCase.execute({ token: 'abc', newPassword: VALID_PASSWORD })).rejects.toThrow('invalid or has expired');
  });

  it('hashes and stores the new password, revokes sessions, and sends a confirmation email', async () => {
    const deps = buildDeps();
    const useCase = new ResetPasswordUseCase(deps);

    await useCase.execute({ token: 'abc', newPassword: VALID_PASSWORD });

    expect(deps.passwordHasher.hash).toHaveBeenCalledWith(VALID_PASSWORD);
    expect(deps.userRepository.update).toHaveBeenCalledWith(5, { passwordHash: 'hashed-password' });
    expect(deps.refreshTokenStore.revokeAllForUser).toHaveBeenCalledWith(5);
    expect(deps.emailService.sendPasswordChangedEmail).toHaveBeenCalledWith('target@example.com', 'Target');
    expect(deps.auditLogRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ actorId: 5, action: 'password-reset-completed', entityType: 'User', entityId: 5 }),
    );
  });

  it('still succeeds even if the confirmation email fails to send', async () => {
    const deps = buildDeps();
    deps.emailService.sendPasswordChangedEmail.mockRejectedValue(new Error('SMTP down'));
    const useCase = new ResetPasswordUseCase(deps);

    await expect(useCase.execute({ token: 'abc', newPassword: VALID_PASSWORD })).resolves.toBeDefined();
  });
});
