import { DeactivateUserUseCase } from '../../../src/use-cases/auth/DeactivateUserUseCase';

function buildRequester(overrides: Record<string, any> = {}) {
  return {
    id: 1,
    isSuperAdmin: () => true,
    ...overrides,
  };
}

function buildTargetUser(overrides: Record<string, any> = {}) {
  const state = { roleName: 'Sales', status: 'approved', ...overrides };
  return {
    id: 5,
    status: state.status,
    isSuperAdmin: () => state.roleName === 'SuperAdmin',
    toSafeJSON: () => ({ id: 5, roleName: state.roleName, status: state.status }),
  };
}

function buildRepos() {
  return {
    userRepository: {
      findById: jest.fn().mockResolvedValue(buildTargetUser()),
      countActiveSuperAdmins: jest.fn().mockResolvedValue(2),
      update: jest.fn().mockResolvedValue({ toSafeJSON: () => ({ id: 5, status: 'deactivated' }) }),
    },
    auditLogRepository: { create: jest.fn() },
    refreshTokenStore: { revokeAllForUser: jest.fn() },
  };
}

describe('DeactivateUserUseCase', () => {
  it('rejects a requester who is not SuperAdmin', async () => {
    const { userRepository, auditLogRepository, refreshTokenStore } = buildRepos();
    const useCase = new DeactivateUserUseCase({ userRepository, auditLogRepository, refreshTokenStore });

    await expect(
      useCase.execute({ requester: buildRequester({ isSuperAdmin: () => false }), targetUserId: 5 })
    ).rejects.toThrow('Only a SuperAdmin');
    expect(userRepository.findById).not.toHaveBeenCalled();
  });

  it('rejects a target user that does not exist', async () => {
    const { userRepository, auditLogRepository, refreshTokenStore } = buildRepos();
    userRepository.findById.mockResolvedValue(null);
    const useCase = new DeactivateUserUseCase({ userRepository, auditLogRepository, refreshTokenStore });

    await expect(
      useCase.execute({ requester: buildRequester(), targetUserId: 999 })
    ).rejects.toThrow('User not found');
  });

  it('rejects a user who is already deactivated', async () => {
    const { userRepository, auditLogRepository, refreshTokenStore } = buildRepos();
    userRepository.findById.mockResolvedValue(buildTargetUser({ status: 'deactivated' }));
    const useCase = new DeactivateUserUseCase({ userRepository, auditLogRepository, refreshTokenStore });

    await expect(
      useCase.execute({ requester: buildRequester(), targetUserId: 5 })
    ).rejects.toThrow('already deactivated');
  });

  it('rejects deactivating the last remaining SuperAdmin', async () => {
    const { userRepository, auditLogRepository, refreshTokenStore } = buildRepos();
    userRepository.findById.mockResolvedValue(buildTargetUser({ roleName: 'SuperAdmin' }));
    userRepository.countActiveSuperAdmins.mockResolvedValue(1);
    const useCase = new DeactivateUserUseCase({ userRepository, auditLogRepository, refreshTokenStore });

    await expect(
      useCase.execute({ requester: buildRequester(), targetUserId: 5 })
    ).rejects.toThrow('last remaining SuperAdmin');
    expect(userRepository.update).not.toHaveBeenCalled();
  });

  it('allows deactivating a SuperAdmin when another active SuperAdmin still exists', async () => {
    const { userRepository, auditLogRepository, refreshTokenStore } = buildRepos();
    userRepository.findById.mockResolvedValue(buildTargetUser({ roleName: 'SuperAdmin' }));
    userRepository.countActiveSuperAdmins.mockResolvedValue(2);
    const useCase = new DeactivateUserUseCase({ userRepository, auditLogRepository, refreshTokenStore });

    await expect(
      useCase.execute({ requester: buildRequester(), targetUserId: 5 })
    ).resolves.toBeDefined();
  });

  it('deactivates a user, revokes tokens, and writes an audit log entry', async () => {
    const { userRepository, auditLogRepository, refreshTokenStore } = buildRepos();
    const useCase = new DeactivateUserUseCase({ userRepository, auditLogRepository, refreshTokenStore });

    await useCase.execute({ requester: buildRequester(), targetUserId: 5 });

    expect(userRepository.update).toHaveBeenCalledWith(5, { status: 'deactivated' });
    expect(refreshTokenStore.revokeAllForUser).toHaveBeenCalledWith(5);
    expect(auditLogRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ actorId: 1, action: 'delete', entityType: 'User', entityId: 5 })
    );
  });
});
