import { ListReachablePeopleUseCase } from '../../../src/use-cases/messaging/ListReachablePeopleUseCase';

function buildRequester(overrides: Record<string, any> = {}) {
  return {
    id: 1,
    roleName: 'Manager',
    isSuperAdmin: () => false,
    ...overrides,
  };
}

describe('ListReachablePeopleUseCase', () => {
  it('rejects a SuperAdmin requester', async () => {
    const conversationRepository = { listReachablePeople: jest.fn() };
    const useCase = new ListReachablePeopleUseCase({ conversationRepository });

    await expect(useCase.execute({ requester: buildRequester({ isSuperAdmin: () => true }) })).rejects.toThrow(
      'SuperAdmin cannot access messaging'
    );
    expect(conversationRepository.listReachablePeople).not.toHaveBeenCalled();
  });

  it('rejects a requester outside the messaging allow-list', async () => {
    const conversationRepository = { listReachablePeople: jest.fn() };
    const useCase = new ListReachablePeopleUseCase({ conversationRepository });

    await expect(useCase.execute({ requester: buildRequester({ roleName: 'Developer' }) })).rejects.toThrow(
      'Only Manager and Instructor'
    );
  });

  it('queries the directory excluding the requester and scoped to allowed roles', async () => {
    const conversationRepository = { listReachablePeople: jest.fn().mockResolvedValue([]) };
    const useCase = new ListReachablePeopleUseCase({ conversationRepository });

    await useCase.execute({ requester: buildRequester(), search: 'jane' });
    expect(conversationRepository.listReachablePeople).toHaveBeenCalledWith({
      excludeUserId: 1,
      roleNames: ['Manager', 'Instructor'],
      search: 'jane',
    });
  });
});
