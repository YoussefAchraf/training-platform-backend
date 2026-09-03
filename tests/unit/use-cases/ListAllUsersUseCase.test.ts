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
      { isDeveloper: () => false, toSafeJSON: () => ({ id: 1, status: 'pending' }) },
      { isDeveloper: () => false, toSafeJSON: () => ({ id: 2, status: 'deactivated' }) },
    ];
    const userRepository = { listAll: jest.fn().mockResolvedValue(users) };
    const useCase = new ListAllUsersUseCase({ userRepository });

    const result = await useCase.execute({ requester: buildRequester({ isSuperAdmin: () => true }) });

    expect(result).toEqual([{ id: 1, status: 'pending' }, { id: 2, status: 'deactivated' }]);
  });

  it('excludes Developer accounts - a separate, script-only silo', async () => {
    const users = [
      { isDeveloper: () => false, toSafeJSON: () => ({ id: 1, status: 'approved' }) },
      { isDeveloper: () => true, toSafeJSON: () => ({ id: 2, status: 'approved' }) },
    ];
    const userRepository = { listAll: jest.fn().mockResolvedValue(users) };
    const useCase = new ListAllUsersUseCase({ userRepository });

    const result = await useCase.execute({ requester: buildRequester({ isSuperAdmin: () => true }) });

    expect(result).toEqual([{ id: 1, status: 'approved' }]);
  });
});
