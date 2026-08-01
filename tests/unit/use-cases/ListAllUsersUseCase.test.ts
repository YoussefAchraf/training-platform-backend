import { ListAllUsersUseCase } from '../../../src/use-cases/auth/ListAllUsersUseCase';

function buildRequester(overrides: Record<string, any> = {}) {
  return {
    isSuperAdmin: () => false,
    ...overrides,
  };
}

describe('ListAllUsersUseCase', () => {
  it('rejects a requester who is not SuperAdmin', async () => {
    const userRepository = { listAll: jest.fn() };
    const useCase = new ListAllUsersUseCase({ userRepository });

    await expect(useCase.execute({ requester: buildRequester() })).rejects.toThrow('Only a SuperAdmin');
    expect(userRepository.listAll).not.toHaveBeenCalled();
  });

  it('returns every user in safe JSON form for a SuperAdmin', async () => {
    const users = [
      { toSafeJSON: () => ({ id: 1, status: 'pending' }) },
      { toSafeJSON: () => ({ id: 2, status: 'deactivated' }) },
    ];
    const userRepository = { listAll: jest.fn().mockResolvedValue(users) };
    const useCase = new ListAllUsersUseCase({ userRepository });

    const result = await useCase.execute({ requester: buildRequester({ isSuperAdmin: () => true }) });

    expect(result).toEqual([{ id: 1, status: 'pending' }, { id: 2, status: 'deactivated' }]);
  });
});
