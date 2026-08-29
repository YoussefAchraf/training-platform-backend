import { GetAuditLogUseCase } from '../../../src/use-cases/admin/GetAuditLogUseCase';

function buildRequester(overrides: Record<string, any> = {}) {
  return {
    isManager: () => false,
    isSuperAdmin: () => false,
    ...overrides,
  };
}

describe('GetAuditLogUseCase', () => {
  it('rejects a requester who is neither Manager nor SuperAdmin', async () => {
    const auditLogRepository = { list: jest.fn() };
    const useCase = new GetAuditLogUseCase({ auditLogRepository });

    await expect(useCase.execute({ requester: buildRequester() })).rejects.toThrow('Only a Manager or SuperAdmin');
    expect(auditLogRepository.list).not.toHaveBeenCalled();
  });

  it('gives a SuperAdmin unfiltered access, including User entity entries', async () => {
    const auditLogRepository = { list: jest.fn().mockResolvedValue([]) };
    const useCase = new GetAuditLogUseCase({ auditLogRepository });

    await useCase.execute({ requester: buildRequester({ isSuperAdmin: () => true }), entityType: 'User' });

    expect(auditLogRepository.list).toHaveBeenCalledWith({
      entityType: 'User',
      entityId: undefined,
      startDate: undefined,
      endDate: undefined,
      roleName: undefined,
    });
  });

  it('passes date-range and role filters through to the repository', async () => {
    const auditLogRepository = { list: jest.fn().mockResolvedValue([]) };
    const useCase = new GetAuditLogUseCase({ auditLogRepository });

    await useCase.execute({
      requester: buildRequester({ isSuperAdmin: () => true }),
      startDate: '2026-01-01T00:00:00.000Z',
      endDate: '2026-01-31T23:59:59.000Z',
      roleName: 'Instructor',
    });

    expect(auditLogRepository.list).toHaveBeenCalledWith({
      entityType: undefined,
      entityId: undefined,
      startDate: '2026-01-01T00:00:00.000Z',
      endDate: '2026-01-31T23:59:59.000Z',
      roleName: 'Instructor',
    });
  });

  it('rejects an unrecognized roleName filter', async () => {
    const auditLogRepository = { list: jest.fn() };
    const useCase = new GetAuditLogUseCase({ auditLogRepository });

    await expect(
      useCase.execute({ requester: buildRequester({ isSuperAdmin: () => true }), roleName: 'Astronaut' })
    ).rejects.toThrow('roleName must be one of');
    expect(auditLogRepository.list).not.toHaveBeenCalled();
  });

  it('rejects a Manager explicitly requesting User entity entries', async () => {
    const auditLogRepository = { list: jest.fn() };
    const useCase = new GetAuditLogUseCase({ auditLogRepository });

    await expect(
      useCase.execute({ requester: buildRequester({ isManager: () => true }), entityType: 'User' })
    ).rejects.toThrow('cannot view audit log entries for User');
    expect(auditLogRepository.list).not.toHaveBeenCalled();
  });

  it('scopes a Manager to non-User entities when no entityType filter is given', async () => {
    const auditLogRepository = { list: jest.fn().mockResolvedValue([]) };
    const useCase = new GetAuditLogUseCase({ auditLogRepository });

    await useCase.execute({ requester: buildRequester({ isManager: () => true }) });

    expect(auditLogRepository.list).toHaveBeenCalledWith({
      entityType: undefined,
      entityId: undefined,
      startDate: undefined,
      endDate: undefined,
      roleName: undefined,
      excludeEntityTypes: ['User'],
    });
  });
});
