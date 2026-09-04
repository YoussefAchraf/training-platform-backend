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
    instructorRepository: {
      findByUserId: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ id: 10 }),
    },
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

  it('rejects a malformed email address before looking up the target user', async () => {
    const { userRepository, auditLogRepository } = buildRepos();
    const useCase = new UpdateUserByAdminUseCase({ userRepository, auditLogRepository });

    await expect(
      useCase.execute({ requester: buildRequester(), targetUserId: 5, email: 'not-an-email' })
    ).rejects.toThrow('valid email');
    expect(userRepository.findById).not.toHaveBeenCalled();
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

  it('creates an instructor profile row when promoting a user to Instructor who does not already have one', async () => {
    const { userRepository, auditLogRepository, instructorRepository } = buildRepos();
    const useCase = new UpdateUserByAdminUseCase({ userRepository, auditLogRepository, instructorRepository });

    await useCase.execute({ requester: buildRequester(), targetUserId: 5, role: 'Instructor' });

    expect(instructorRepository.findByUserId).toHaveBeenCalledWith(5);
    expect(instructorRepository.create).toHaveBeenCalledWith({ userId: 5, bio: '' });
  });

  it('does not create a duplicate instructor profile row if one already exists', async () => {
    const { userRepository, auditLogRepository, instructorRepository } = buildRepos();
    instructorRepository.findByUserId.mockResolvedValue({ id: 3, userId: 5 });
    const useCase = new UpdateUserByAdminUseCase({ userRepository, auditLogRepository, instructorRepository });

    await useCase.execute({ requester: buildRequester(), targetUserId: 5, role: 'Instructor' });

    expect(instructorRepository.create).not.toHaveBeenCalled();
  });

  it('does not touch the instructor repository when the role is left unchanged or set to something else', async () => {
    const { userRepository, auditLogRepository, instructorRepository } = buildRepos();
    const useCase = new UpdateUserByAdminUseCase({ userRepository, auditLogRepository, instructorRepository });

    await useCase.execute({ requester: buildRequester(), targetUserId: 5, firstname: 'New' });
    await useCase.execute({ requester: buildRequester(), targetUserId: 5, role: 'Manager' });

    expect(instructorRepository.findByUserId).not.toHaveBeenCalled();
    expect(instructorRepository.create).not.toHaveBeenCalled();
  });
});
