import { MarkConversationReadUseCase } from '../../../src/use-cases/messaging/MarkConversationReadUseCase';

function buildRequester(overrides: Record<string, any> = {}) {
  return {
    id: 1,
    isSuperAdmin: () => false,
    ...overrides,
  };
}

function buildRepos() {
  return {
    conversationRepository: {
      isParticipant: jest.fn().mockResolvedValue(true),
      markRead: jest.fn().mockResolvedValue({ userId: 1, lastReadMessageId: 42 }),
    },
  };
}

describe('MarkConversationReadUseCase', () => {
  it('rejects a SuperAdmin requester', async () => {
    const repos = buildRepos();
    const useCase = new MarkConversationReadUseCase(repos);

    await expect(
      useCase.execute({ requester: buildRequester({ isSuperAdmin: () => true }), conversationId: 10, messageId: 42 })
    ).rejects.toThrow('SuperAdmin cannot access messaging');
  });

  it('requires a messageId', async () => {
    const repos = buildRepos();
    const useCase = new MarkConversationReadUseCase(repos);

    await expect(useCase.execute({ requester: buildRequester(), conversationId: 10, messageId: undefined })).rejects.toThrow(
      'message id'
    );
  });

  it('rejects a non-participant', async () => {
    const repos = buildRepos();
    repos.conversationRepository.isParticipant.mockResolvedValue(false);
    const useCase = new MarkConversationReadUseCase(repos);

    await expect(useCase.execute({ requester: buildRequester(), conversationId: 10, messageId: 42 })).rejects.toThrow(
      'not a participant'
    );
  });

  it('marks the conversation read up to the given message for a participant', async () => {
    const repos = buildRepos();
    const useCase = new MarkConversationReadUseCase(repos);

    const result = await useCase.execute({ requester: buildRequester(), conversationId: 10, messageId: 42 });
    expect(result).toEqual({ userId: 1, lastReadMessageId: 42 });
    expect(repos.conversationRepository.markRead).toHaveBeenCalledWith(10, 1, 42);
  });

  it('broadcasts the read state to the same user\'s other sessions in real time', async () => {
    const repos = buildRepos();
    const messagingRealtime = { broadcastRead: jest.fn() };
    const useCase = new MarkConversationReadUseCase({ ...repos, messagingRealtime });

    await useCase.execute({ requester: buildRequester(), conversationId: 10, messageId: 42 });
    expect(messagingRealtime.broadcastRead).toHaveBeenCalledWith(1, 10, 42);
  });
});
