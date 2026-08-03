import { UpdateOwnProfileUseCase } from '../../../src/use-cases/auth/UpdateOwnProfileUseCase';

function buildRequester(overrides: Record<string, any> = {}) {
  return {
    id: 1,
    toSafeJSON: () => ({ id: 1, firstname: 'Old', lastname: 'Name' }),
    ...overrides,
  };
}

describe('UpdateOwnProfileUseCase', () => {
  it('updates the requester own profile and writes an audit log entry', async () => {
    const userRepository = {
      update: jest.fn().mockResolvedValue({ toSafeJSON: () => ({ id: 1, firstname: 'New', lastname: 'Name' }) }),
    };
    const auditLogRepository = { create: jest.fn() };
    const useCase = new UpdateOwnProfileUseCase({ userRepository, auditLogRepository });

    const result = await useCase.execute({ requester: buildRequester(), firstname: 'New' });

    expect(userRepository.update).toHaveBeenCalledWith(1, { firstname: 'New', lastname: undefined });
    expect(result).toEqual({ id: 1, firstname: 'New', lastname: 'Name' });
    expect(auditLogRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: 1,
        action: 'update',
        entityType: 'User',
        entityId: 1,
        before: { id: 1, firstname: 'Old', lastname: 'Name' },
      })
    );
  });
});
