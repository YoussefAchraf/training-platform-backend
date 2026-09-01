import { ChangeOwnPasswordUseCase } from '../../../src/use-cases/auth/ChangeOwnPasswordUseCase';

function buildRequester(overrides: Record<string, any> = {}) {
  return { id: 5, ...overrides };
}

function buildDeps() {
  return {
    userRepository: {
      findById: jest.fn().mockResolvedValue({
        id: 5,
        email: 'me@example.com',
        firstname: 'Me',
        roleName: 'Sales',
        passwordHash: 'old-hash',
      }),
      update: jest.fn().mockResolvedValue(undefined),
    },
    passwordHasher: {
      compare: jest.fn().mockResolvedValue(true),
      hash: jest.fn().mockResolvedValue('new-hash'),
    },
    tokenService: { signAccessToken: jest.fn().mockReturnValue('a-new-access-token') },
    refreshTokenStore: {
      revokeAllForUser: jest.fn(),
      issue: jest.fn().mockResolvedValue('a-new-refresh-token'),
    },
    emailService: { sendPasswordChangedEmail: jest.fn() },
    auditLogRepository: { create: jest.fn() },
  };
}

const VALID_PASSWORD = 'newpassword123';

describe('ChangeOwnPasswordUseCase', () => {
  it('rejects when the current password is wrong', async () => {
    const deps = buildDeps();
    deps.passwordHasher.compare.mockResolvedValue(false);
    const useCase = new ChangeOwnPasswordUseCase(deps);

    await expect(
      useCase.execute({ requester: buildRequester(), currentPassword: 'wrong', newPassword: VALID_PASSWORD })
    ).rejects.toThrow('Current password is incorrect');
    expect(deps.userRepository.update).not.toHaveBeenCalled();
  });

  it('rejects a weak new password', async () => {
    const deps = buildDeps();
    const useCase = new ChangeOwnPasswordUseCase(deps);

    await expect(
      useCase.execute({ requester: buildRequester(), currentPassword: 'old-plain', newPassword: 'short1' })
    ).rejects.toThrow('at least 10 characters');
  });

  it('rejects a new password identical to the current one', async () => {
    const deps = buildDeps();
    const useCase = new ChangeOwnPasswordUseCase(deps);

    await expect(
      useCase.execute({ requester: buildRequester(), currentPassword: VALID_PASSWORD, newPassword: VALID_PASSWORD })
    ).rejects.toThrow('must be different');
  });

  it('hashes and stores the new password, revokes every other session, and reissues a fresh one', async () => {
    const deps = buildDeps();
    const useCase = new ChangeOwnPasswordUseCase(deps);

    const result = await useCase.execute({ requester: buildRequester(), currentPassword: 'old-plain', newPassword: VALID_PASSWORD });

    expect(deps.passwordHasher.hash).toHaveBeenCalledWith(VALID_PASSWORD);
    expect(deps.userRepository.update).toHaveBeenCalledWith(5, { passwordHash: 'new-hash' });
    expect(deps.refreshTokenStore.revokeAllForUser).toHaveBeenCalledWith(5);
    expect(deps.refreshTokenStore.issue).toHaveBeenCalledWith(5);
    expect(deps.emailService.sendPasswordChangedEmail).toHaveBeenCalledWith('me@example.com', 'Me');
    expect(deps.auditLogRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ actorId: 5, action: 'change-password', entityType: 'User', entityId: 5 }),
    );
    expect(result).toEqual({ accessToken: 'a-new-access-token', refreshToken: 'a-new-refresh-token' });
  });

  it('still succeeds even if the confirmation email fails to send', async () => {
    const deps = buildDeps();
    deps.emailService.sendPasswordChangedEmail.mockRejectedValue(new Error('SMTP down'));
    const useCase = new ChangeOwnPasswordUseCase(deps);

    await expect(
      useCase.execute({ requester: buildRequester(), currentPassword: 'old-plain', newPassword: VALID_PASSWORD })
    ).resolves.toBeDefined();
  });
});
