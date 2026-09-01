import { RequestPasswordResetUseCase } from '../../../src/use-cases/auth/RequestPasswordResetUseCase';

function buildRequester(overrides: Record<string, any> = {}) {
  return {
    id: 1,
    isSuperAdmin: () => true,
    ...overrides,
  };
}

function buildTargetUser(overrides: Record<string, any> = {}) {
  const state = { roleName: 'Sales', ...overrides };
  return {
    id: 5,
    email: 'target@example.com',
    firstname: 'Target',
    roleName: state.roleName,
    isSuperAdmin: () => state.roleName === 'SuperAdmin',
  };
}

function buildDeps() {
  return {
    userRepository: { findById: jest.fn().mockResolvedValue(buildTargetUser()) },
    passwordResetTokenStore: { issue: jest.fn().mockResolvedValue('a-reset-token') },
    refreshTokenStore: { revokeAllForUser: jest.fn() },
    emailService: { sendPasswordResetEmail: jest.fn() },
    auditLogRepository: { create: jest.fn() },
  };
}

describe('RequestPasswordResetUseCase', () => {
  it('rejects a requester who is not SuperAdmin', async () => {
    const deps = buildDeps();
    const useCase = new RequestPasswordResetUseCase(deps);

    await expect(
      useCase.execute({ requester: buildRequester({ isSuperAdmin: () => false }), targetUserId: 5 })
    ).rejects.toThrow('Only a SuperAdmin');
    expect(deps.userRepository.findById).not.toHaveBeenCalled();
  });

  it('rejects a target user that does not exist', async () => {
    const deps = buildDeps();
    deps.userRepository.findById.mockResolvedValue(null);
    const useCase = new RequestPasswordResetUseCase(deps);

    await expect(useCase.execute({ requester: buildRequester(), targetUserId: 999 })).rejects.toThrow('User not found');
  });

  it('rejects targeting another SuperAdmin account', async () => {
    const deps = buildDeps();
    deps.userRepository.findById.mockResolvedValue(buildTargetUser({ roleName: 'SuperAdmin' }));
    const useCase = new RequestPasswordResetUseCase(deps);

    await expect(useCase.execute({ requester: buildRequester(), targetUserId: 5 })).rejects.toThrow('Cannot send a password reset for a SuperAdmin');
    expect(deps.passwordResetTokenStore.issue).not.toHaveBeenCalled();
  });

  it('issues a token, revokes existing sessions, and emails the reset link', async () => {
    const deps = buildDeps();
    const useCase = new RequestPasswordResetUseCase(deps);

    await useCase.execute({ requester: buildRequester(), targetUserId: 5 });

    expect(deps.passwordResetTokenStore.issue).toHaveBeenCalledWith(5);
    expect(deps.refreshTokenStore.revokeAllForUser).toHaveBeenCalledWith(5);
    expect(deps.emailService.sendPasswordResetEmail).toHaveBeenCalledWith(
      'target@example.com',
      'Target',
      expect.stringContaining('a-reset-token'),
    );
    expect(deps.auditLogRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ actorId: 1, action: 'password-reset-requested', entityType: 'User', entityId: 5 }),
    );
  });

  it('propagates an email send failure instead of silently succeeding', async () => {
    const deps = buildDeps();
    deps.emailService.sendPasswordResetEmail.mockRejectedValue(new Error('SMTP down'));
    const useCase = new RequestPasswordResetUseCase(deps);

    await expect(useCase.execute({ requester: buildRequester(), targetUserId: 5 })).rejects.toThrow('SMTP down');
    expect(deps.auditLogRepository.create).not.toHaveBeenCalled();
  });
});
