import { ApproveUserUseCase } from '../../../src/use-cases/auth/ApproveUserUseCase';

function buildManager(overrides: Record<string, any> = {}) {
  return {
    id: 1,
    isManager: () => true,
    isSuperAdmin: () => false,
    ...overrides,
  };
}

function buildTargetUser(overrides: Record<string, any> = {}) {
  return {
    id: 2,
    email: 'pending@example.com',
    firstname: 'Pat',
    status: 'pending',
    toSafeJSON: () => ({ id: 2, email: 'pending@example.com', status: overrides.status || 'pending' }),
    ...overrides,
  };
}

describe('ApproveUserUseCase', () => {
  it('rejects a non-Manager actor before touching any repository', async () => {
    const userRepository = { findById: jest.fn(), approve: jest.fn() };
    const auditLogRepository = { create: jest.fn() };
    const useCase = new ApproveUserUseCase({
      userRepository,
      emailService: { sendAccountApprovedEmail: jest.fn() },
      refreshTokenStore: { revokeAllForUser: jest.fn() },
      auditLogRepository,
    });

    await expect(
      useCase.execute({ managerUser: buildManager({ isManager: () => false }), targetUserId: 2, decision: 'approve' })
    ).rejects.toThrow('Only a Manager');

    expect(userRepository.findById).not.toHaveBeenCalled();
    expect(auditLogRepository.create).not.toHaveBeenCalled();
  });

  it('allows a SuperAdmin actor even though they are not a Manager', async () => {
    const targetUser = buildTargetUser();
    const approvedUser = buildTargetUser({ status: 'approved' });
    const userRepository = {
      findById: jest.fn().mockResolvedValue(targetUser),
      approve: jest.fn().mockResolvedValue(approvedUser),
    };
    const auditLogRepository = { create: jest.fn() };
    const useCase = new ApproveUserUseCase({
      userRepository,
      emailService: { sendAccountApprovedEmail: jest.fn() },
      refreshTokenStore: { revokeAllForUser: jest.fn() },
      auditLogRepository,
    });

    const superAdmin = buildManager({ isManager: () => false, isSuperAdmin: () => true });

    await expect(
      useCase.execute({ managerUser: superAdmin, targetUserId: 2, decision: 'approve' })
    ).resolves.toBeDefined();

    expect(userRepository.approve).toHaveBeenCalledWith(2, superAdmin.id);
  });

  it('writes an audit log entry with before/after state on approve', async () => {
    const targetUser = buildTargetUser();
    const approvedUser = buildTargetUser({ status: 'approved' });
    const userRepository = {
      findById: jest.fn().mockResolvedValue(targetUser),
      approve: jest.fn().mockResolvedValue(approvedUser),
    };
    const auditLogRepository = { create: jest.fn() };
    const emailService = { sendAccountApprovedEmail: jest.fn() };
    const useCase = new ApproveUserUseCase({
      userRepository,
      emailService,
      refreshTokenStore: { revokeAllForUser: jest.fn() },
      auditLogRepository,
    });

    await useCase.execute({ managerUser: buildManager(), targetUserId: 2, decision: 'approve' });

    expect(auditLogRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: 1,
        action: 'approve',
        entityType: 'User',
        entityId: 2,
        before: targetUser.toSafeJSON(),
        after: approvedUser.toSafeJSON(),
      })
    );
    expect(emailService.sendAccountApprovedEmail).toHaveBeenCalled();
  });

  it('writes an audit log entry and revokes refresh tokens on reject', async () => {
    const targetUser = buildTargetUser();
    const rejectedUser = buildTargetUser({ status: 'rejected' });
    const userRepository = {
      findById: jest.fn().mockResolvedValue(targetUser),
      reject: jest.fn().mockResolvedValue(rejectedUser),
    };
    const auditLogRepository = { create: jest.fn() };
    const refreshTokenStore = { revokeAllForUser: jest.fn() };
    const useCase = new ApproveUserUseCase({
      userRepository,
      emailService: { sendAccountRejectedEmail: jest.fn() },
      refreshTokenStore,
      auditLogRepository,
    });

    await useCase.execute({ managerUser: buildManager(), targetUserId: 2, decision: 'reject' });

    expect(auditLogRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ actorId: 1, action: 'reject', entityType: 'User', entityId: 2 })
    );
    expect(refreshTokenStore.revokeAllForUser).toHaveBeenCalledWith(2);
  });
});
