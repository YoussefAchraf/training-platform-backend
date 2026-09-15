import { ListConversationsUseCase } from '../../../src/use-cases/messaging/ListConversationsUseCase';

function buildRequester(overrides: Record<string, any> = {}) {
  return {
    id: 1,
    roleName: 'Manager',
    isSuperAdmin: () => false,
    ...overrides,
  };
}

describe('ListConversationsUseCase', () => {
  it('rejects a SuperAdmin requester', async () => {
    const conversationRepository = { listForUser: jest.fn() };
    const useCase = new ListConversationsUseCase({ conversationRepository });

    await expect(useCase.execute({ requester: buildRequester({ isSuperAdmin: () => true }) })).rejects.toThrow(
      'SuperAdmin cannot access messaging'
    );
    expect(conversationRepository.listForUser).not.toHaveBeenCalled();
  });

  it('rejects a requester outside the messaging allow-list', async () => {
    const conversationRepository = { listForUser: jest.fn() };
    const useCase = new ListConversationsUseCase({ conversationRepository });

    await expect(useCase.execute({ requester: buildRequester({ roleName: 'Sales' }) })).rejects.toThrow(
      'Only Manager and Instructor'
    );
  });

  it('lists conversations for an allowed requester', async () => {
    const conversationRepository = { listForUser: jest.fn().mockResolvedValue([{ id: 1 }]) };
    const useCase = new ListConversationsUseCase({ conversationRepository });

    const result = await useCase.execute({ requester: buildRequester() });
    expect(result).toEqual([{ id: 1 }]);
    expect(conversationRepository.listForUser).toHaveBeenCalledWith(1);
  });
});
