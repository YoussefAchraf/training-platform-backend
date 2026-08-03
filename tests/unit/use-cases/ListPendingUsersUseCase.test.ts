import { ListPendingUsersUseCase } from '../../../src/use-cases/auth/ListPendingUsersUseCase';

function buildRequester(overrides: Record<string, any> = {}) {
  return {
    isManager: () => false,
    isSuperAdmin: () => false,
    ...overrides,
  };
}

describe('ListPendingUsersUseCase', () => {
  it('rejects a requester who is neither Manager nor SuperAdmin', async () => {
    const userRepository = { listPending: jest.fn() };
    const useCase = new ListPendingUsersUseCase({ userRepository });

    await expect(useCase.execute({ managerUser: buildRequester() })).rejects.toThrow('Only a Manager');
    expect(userRepository.listPending).not.toHaveBeenCalled();
  });

  it('allows a Manager', async () => {
    const userRepository = { listPending: jest.fn().mockResolvedValue([]) };
    const useCase = new ListPendingUsersUseCase({ userRepository });

    await expect(useCase.execute({ managerUser: buildRequester({ isManager: () => true }) })).resolves.toEqual([]);
  });

  it('allows a SuperAdmin even though they are not a Manager', async () => {
    const userRepository = { listPending: jest.fn().mockResolvedValue([]) };
    const useCase = new ListPendingUsersUseCase({ userRepository });

    await expect(
      useCase.execute({ managerUser: buildRequester({ isSuperAdmin: () => true }) })
    ).resolves.toEqual([]);
    expect(userRepository.listPending).toHaveBeenCalled();
  });
});
