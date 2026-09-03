import { HardDeleteUserUseCase } from '../../../src/use-cases/auth/HardDeleteUserUseCase';

function buildRequester(overrides: Record<string, any> = {}) {
  return {
    id: 1,
    isSuperAdmin: () => true,
    ...overrides,
  };
}

function buildTargetUser(overrides: Record<string, any> = {}) {
  return {
    id: 5,
    status: 'deactivated',
    roleName: 'Sales',
    ...overrides,
  };
}

function buildRepos() {
  return {
    userRepository: {
      findById: jest.fn().mockResolvedValue(buildTargetUser()),
      hardDelete: jest.fn().mockResolvedValue(undefined),
    },
    auditLogRepository: {
      redactUserEntries: jest.fn().mockResolvedValue(undefined),
      create: jest.fn(),
    },
  };
}

describe('HardDeleteUserUseCase', () => {
  it('rejects a requester who is not SuperAdmin', async () => {
    const { userRepository, auditLogRepository } = buildRepos();
    const useCase = new HardDeleteUserUseCase({ userRepository, auditLogRepository });

    await expect(
      useCase.execute({ requester: buildRequester({ isSuperAdmin: () => false }), targetUserId: 5 })
    ).rejects.toThrow('Only a SuperAdmin');
    expect(userRepository.findById).not.toHaveBeenCalled();
  });

  it('rejects a requester targeting their own account', async () => {
    const { userRepository, auditLogRepository } = buildRepos();
    const useCase = new HardDeleteUserUseCase({ userRepository, auditLogRepository });

    await expect(
      useCase.execute({ requester: buildRequester({ id: 5 }), targetUserId: 5 })
    ).rejects.toThrow('own account');
    expect(userRepository.findById).not.toHaveBeenCalled();
  });

  it('rejects a target user that does not exist', async () => {
    const { userRepository, auditLogRepository } = buildRepos();
    userRepository.findById.mockResolvedValue(null);
    const useCase = new HardDeleteUserUseCase({ userRepository, auditLogRepository });

    await expect(
      useCase.execute({ requester: buildRequester(), targetUserId: 999 })
    ).rejects.toThrow('User not found');
  });

  it('rejects a user who is not yet deactivated', async () => {
    const { userRepository, auditLogRepository } = buildRepos();
    userRepository.findById.mockResolvedValue(buildTargetUser({ status: 'approved' }));
    const useCase = new HardDeleteUserUseCase({ userRepository, auditLogRepository });

    await expect(
      useCase.execute({ requester: buildRequester(), targetUserId: 5 })
    ).rejects.toThrow('deactivate the account first');
    expect(userRepository.hardDelete).not.toHaveBeenCalled();
  });

  it('redacts audit entries, deletes the user, and logs a redacted purge entry - in that order', async () => {
    const { userRepository, auditLogRepository } = buildRepos();
    const useCase = new HardDeleteUserUseCase({ userRepository, auditLogRepository });

    const calls: string[] = [];
    auditLogRepository.redactUserEntries.mockImplementation(async () => { calls.push('redact'); });
    userRepository.hardDelete.mockImplementation(async () => { calls.push('delete'); });
    auditLogRepository.create.mockImplementation(async () => { calls.push('log'); });

    const result = await useCase.execute({ requester: buildRequester(), targetUserId: 5 });

    expect(calls).toEqual(['redact', 'delete', 'log']);
    expect(auditLogRepository.redactUserEntries).toHaveBeenCalledWith(5);
    expect(userRepository.hardDelete).toHaveBeenCalledWith(5);
    expect(result).toEqual({ id: 5, deleted: true });
  });

  it('logs the purge entry without the deleted user\'s name or email', async () => {
    const { userRepository, auditLogRepository } = buildRepos();
    const useCase = new HardDeleteUserUseCase({ userRepository, auditLogRepository });

    await useCase.execute({ requester: buildRequester(), targetUserId: 5 });

    expect(auditLogRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ actorId: 1, action: 'purge', entityType: 'User', entityId: 5, after: null })
    );
    const [[loggedEntry]] = auditLogRepository.create.mock.calls;
    expect(loggedEntry.before).not.toHaveProperty('firstname');
    expect(loggedEntry.before).not.toHaveProperty('lastname');
    expect(loggedEntry.before).not.toHaveProperty('email');
  });
});
