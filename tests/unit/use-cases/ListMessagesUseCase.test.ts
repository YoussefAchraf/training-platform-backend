import { ListMessagesUseCase } from '../../../src/use-cases/messaging/ListMessagesUseCase';

function buildRequester(overrides: Record<string, any> = {}) {
  return {
    id: 1,
    isSuperAdmin: () => false,
    ...overrides,
  };
}

function buildRepos() {
  return {
    conversationRepository: { isParticipant: jest.fn().mockResolvedValue(true) },
    messageRepository: { listByConversation: jest.fn().mockResolvedValue([{ id: 1 }]) },
  };
}

describe('ListMessagesUseCase', () => {
  it('rejects a SuperAdmin requester', async () => {
    const repos = buildRepos();
    const useCase = new ListMessagesUseCase(repos);

    await expect(
      useCase.execute({ requester: buildRequester({ isSuperAdmin: () => true }), conversationId: 10 })
    ).rejects.toThrow('SuperAdmin cannot access messaging');
    expect(repos.conversationRepository.isParticipant).not.toHaveBeenCalled();
  });

  it('rejects a non-participant', async () => {
    const repos = buildRepos();
    repos.conversationRepository.isParticipant.mockResolvedValue(false);
    const useCase = new ListMessagesUseCase(repos);

    await expect(useCase.execute({ requester: buildRequester(), conversationId: 10 })).rejects.toThrow(
      'not a participant'
    );
  });

  it('lists messages with the given cursor/limit for a participant', async () => {
    const repos = buildRepos();
    const useCase = new ListMessagesUseCase(repos);

    const result = await useCase.execute({ requester: buildRequester(), conversationId: 10, cursor: 50, limit: 20 });
    expect(result).toEqual([{ id: 1 }]);
    expect(repos.messageRepository.listByConversation).toHaveBeenCalledWith(10, { cursor: 50, limit: 20, requesterId: 1 });
  });

  it('opportunistically marks the newest fetched message delivered and broadcasts it', async () => {
    const repos = buildRepos();
    repos.messageRepository.listByConversation.mockResolvedValue([{ id: 5 }, { id: 7 }]);
    const conversationRepository = {
      ...repos.conversationRepository,
      markDelivered: jest.fn().mockResolvedValue({ userId: 1, lastDeliveredMessageId: 7 }),
    };
    const messagingRealtime = { broadcastDelivered: jest.fn() };
    const useCase = new ListMessagesUseCase({ ...repos, conversationRepository, messagingRealtime });

    await useCase.execute({ requester: buildRequester(), conversationId: 10 });
    await conversationRepository.markDelivered.mock.results[0].value;

    expect(conversationRepository.markDelivered).toHaveBeenCalledWith(10, 1, 7);
    expect(messagingRealtime.broadcastDelivered).toHaveBeenCalledWith(10, { userId: 1, lastDeliveredMessageId: 7 });
  });

  it('does not attempt to mark delivered when there are no messages', async () => {
    const repos = buildRepos();
    repos.messageRepository.listByConversation.mockResolvedValue([]);
    const conversationRepository = { ...repos.conversationRepository, markDelivered: jest.fn() };
    const useCase = new ListMessagesUseCase({ ...repos, conversationRepository });

    await useCase.execute({ requester: buildRequester(), conversationId: 10 });

    expect(conversationRepository.markDelivered).not.toHaveBeenCalled();
  });
});
