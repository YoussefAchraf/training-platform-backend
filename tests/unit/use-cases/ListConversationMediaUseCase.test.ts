import { ListConversationMediaUseCase } from '../../../src/use-cases/messaging/ListConversationMediaUseCase';

function buildRequester(overrides: Record<string, any> = {}) {
  return {
    id: 1,
    isSuperAdmin: () => false,
    ...overrides,
  };
}

function buildDeps() {
  return {
    conversationRepository: { isParticipant: jest.fn().mockResolvedValue(true) },
    messageRepository: { listByConversationFiltered: jest.fn().mockResolvedValue([{ id: 1 }]) },
  };
}

describe('ListConversationMediaUseCase', () => {
  it('rejects a SuperAdmin requester', async () => {
    const deps = buildDeps();
    const useCase = new ListConversationMediaUseCase(deps);

    await expect(
      useCase.execute({ requester: buildRequester({ isSuperAdmin: () => true }), conversationId: 10, filter: 'media' })
    ).rejects.toThrow('SuperAdmin cannot access messaging');
    expect(deps.conversationRepository.isParticipant).not.toHaveBeenCalled();
  });

  it('rejects an invalid filter', async () => {
    const deps = buildDeps();
    const useCase = new ListConversationMediaUseCase(deps);

    await expect(
      useCase.execute({ requester: buildRequester(), conversationId: 10, filter: 'videos' })
    ).rejects.toThrow('Invalid media filter');
  });

  it('rejects a non-participant', async () => {
    const deps = buildDeps();
    deps.conversationRepository.isParticipant.mockResolvedValue(false);
    const useCase = new ListConversationMediaUseCase(deps);

    await expect(
      useCase.execute({ requester: buildRequester(), conversationId: 10, filter: 'media' })
    ).rejects.toThrow('not a participant');
  });

  it('delegates to the repository with the requester id for exclusion filtering', async () => {
    const deps = buildDeps();
    const useCase = new ListConversationMediaUseCase(deps);

    const result = await useCase.execute({ requester: buildRequester(), conversationId: 10, filter: 'files', cursor: 5, limit: 20 });

    expect(result).toEqual([{ id: 1 }]);
    expect(deps.messageRepository.listByConversationFiltered).toHaveBeenCalledWith(10, {
      filter: 'files',
      cursor: 5,
      limit: 20,
      requesterId: 1,
    });
  });
});
