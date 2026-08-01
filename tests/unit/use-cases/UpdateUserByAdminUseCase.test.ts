import { UpdateUserByAdminUseCase } from '../../../src/use-cases/auth/UpdateUserByAdminUseCase';

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
    roleName: state.roleName,
    status: state.status,
    isSuperAdmin: () => state.roleName === 'SuperAdmin',
    toSafeJSON: () => ({ id: 5, roleName: state.roleName, status: state.status }),
  };
}

function buildRepos() {
  return {
    userRepository: {
      findById: jest.fn().mockResolvedValue(buildTargetUser()),
      findRoleByName: jest.fn().mockResolvedValue({ id: 2 }),
      countActiveSuperAdmins: jest.fn().mockResolvedValue(2),
      update: jest.fn().mockImplementation(async (id, fields) => ({
        toSafeJSON: () => ({ id, ...fields }),
      })),
    },
    auditLogRepository: { create: jest.fn() },
  };
}

describe('UpdateUserByAdminUseCase', () => {
  it('rejects a requester who is not SuperAdmin', async () => {
    const { userRepository, auditLogRepository } = buildRepos();
    const useCase = new UpdateUserByAdminUseCase({ userRepository, auditLogRepository });

    await expect(
      useCase.execute({ requester: buildRequester({ isSuperAdmin: () => false }), targetUserId: 5, firstname: 'X' })
    ).rejects.toThrow('Only a SuperAdmin');
    expect(userRepository.findById).not.toHaveBeenCalled();
  });

  it('rejects a target user that does not exist', async () => {
    const { userRepository, auditLogRepository } = buildRepos();
    userRepository.findById.mockResolvedValue(null);
    const useCase = new UpdateUserByAdminUseCase({ userRepository, auditLogRepository });

    await expect(
      useCase.execute({ requester: buildRequester(), targetUserId: 999 })
    ).rejects.toThrow('User not found');
  });

  it('rejects an unknown role', async () => {
    const { userRepository, auditLogRepository } = buildRepos();
    const useCase = new UpdateUserByAdminUseCase({ userRepository, auditLogRepository });

    await expect(
      useCase.execute({ requester: buildRequester(), targetUserId: 5, role: 'NotARole' })
    ).rejects.toThrow('role must be one of');
  });

  it('rejects an unknown status', async () => {
    const { userRepository, auditLogRepository } = buildRepos();
    const useCase = new UpdateUserByAdminUseCase({ userRepository, auditLogRepository });

    await expect(
      useCase.execute({ requester: buildRequester(), targetUserId: 5, status: 'not-a-status' })
    ).rejects.toThrow('status must be one of');
  });

  it('rejects demoting the last remaining SuperAdmin', async () => {
    const { userRepository, auditLogRepository } = buildRepos();
    userRepository.findById.mockResolvedValue(buildTargetUser({ roleName: 'SuperAdmin' }));
    userRepository.countActiveSuperAdmins.mockResolvedValue(1);
    const useCase = new UpdateUserByAdminUseCase({ userRepository, auditLogRepository });

    await expect(
      useCase.execute({ requester: buildRequester(), targetUserId: 5, role: 'Sales' })
    ).rejects.toThrow('last remaining SuperAdmin');
    expect(userRepository.update).not.toHaveBeenCalled();
  });

  it('rejects deactivating the last remaining SuperAdmin via status change', async () => {
    const { userRepository, auditLogRepository } = buildRepos();
    userRepository.findById.mockResolvedValue(buildTargetUser({ roleName: 'SuperAdmin' }));
    userRepository.countActiveSuperAdmins.mockResolvedValue(1);
    const useCase = new UpdateUserByAdminUseCase({ userRepository, auditLogRepository });

    await expect(
      useCase.execute({ requester: buildRequester(), targetUserId: 5, status: 'deactivated' })
    ).rejects.toThrow('last remaining SuperAdmin');
  });

  it('allows demoting a SuperAdmin when another active SuperAdmin still exists', async () => {
    const { userRepository, auditLogRepository } = buildRepos();
    userRepository.findById.mockResolvedValue(buildTargetUser({ roleName: 'SuperAdmin' }));
    userRepository.countActiveSuperAdmins.mockResolvedValue(2);
    const useCase = new UpdateUserByAdminUseCase({ userRepository, auditLogRepository });

    await expect(
      useCase.execute({ requester: buildRequester(), targetUserId: 5, role: 'Sales' })
    ).resolves.toBeDefined();
  });

  it('updates a user and writes an audit log entry', async () => {
    const { userRepository, auditLogRepository } = buildRepos();
    const useCase = new UpdateUserByAdminUseCase({ userRepository, auditLogRepository });

    await useCase.execute({ requester: buildRequester(), targetUserId: 5, firstname: 'New' });

    expect(userRepository.update).toHaveBeenCalledWith(5, {
      firstname: 'New',
      lastname: undefined,
      email: undefined,
      roleId: undefined,
      status: undefined,
    });
    expect(auditLogRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ actorId: 1, action: 'update', entityType: 'User', entityId: 5 })
    );
  });
});
