import { HideConversationUseCase } from '../../../src/use-cases/messaging/HideConversationUseCase';

function buildRequester(overrides: Record<string, any> = {}) {
  return {
    id: 1,
    isSuperAdmin: () => false,
    ...overrides,
  };
}

function buildDeps() {
  return {
    conversationRepository: {
      isParticipant: jest.fn().mockResolvedValue(true),
      hideConversation: jest.fn().mockResolvedValue(undefined),
    },
  };
}

describe('HideConversationUseCase', () => {
  it('rejects a SuperAdmin requester', async () => {
    const deps = buildDeps();
    const useCase = new HideConversationUseCase(deps);

    await expect(
      useCase.execute({ requester: buildRequester({ isSuperAdmin: () => true }), conversationId: 10 })
    ).rejects.toThrow('SuperAdmin cannot access messaging');
    expect(deps.conversationRepository.hideConversation).not.toHaveBeenCalled();
  });

  it('rejects a non-participant', async () => {
    const deps = buildDeps();
    deps.conversationRepository.isParticipant.mockResolvedValue(false);
    const useCase = new HideConversationUseCase(deps);

    await expect(useCase.execute({ requester: buildRequester(), conversationId: 10 })).rejects.toThrow(
      'not a participant'
    );
  });

  it('hides the conversation for the requester and notifies their other sessions', async () => {
    const deps = buildDeps();
    const messagingRealtime = { notifyConversationHidden: jest.fn() };
    const useCase = new HideConversationUseCase({ ...deps, messagingRealtime });

    const result = await useCase.execute({ requester: buildRequester(), conversationId: 10 });

    expect(deps.conversationRepository.hideConversation).toHaveBeenCalledWith(10, 1);
    expect(messagingRealtime.notifyConversationHidden).toHaveBeenCalledWith(1, 10);
    expect(result).toEqual({ conversationId: 10 });
  });
});
