import { SetConversationMutedUseCase } from '../../../src/use-cases/messaging/SetConversationMutedUseCase';

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
      setMuted: jest.fn().mockResolvedValue(undefined),
    },
  };
}

describe('SetConversationMutedUseCase', () => {
  it('rejects a SuperAdmin requester', async () => {
    const deps = buildDeps();
    const useCase = new SetConversationMutedUseCase(deps);

    await expect(
      useCase.execute({ requester: buildRequester({ isSuperAdmin: () => true }), conversationId: 10, muted: true })
    ).rejects.toThrow('SuperAdmin cannot access messaging');
    expect(deps.conversationRepository.setMuted).not.toHaveBeenCalled();
  });

  it('rejects a non-participant', async () => {
    const deps = buildDeps();
    deps.conversationRepository.isParticipant.mockResolvedValue(false);
    const useCase = new SetConversationMutedUseCase(deps);

    await expect(useCase.execute({ requester: buildRequester(), conversationId: 10, muted: true })).rejects.toThrow(
      'not a participant'
    );
  });

  it('mutes the conversation for the requester and notifies their other sessions', async () => {
    const deps = buildDeps();
    const messagingRealtime = { notifyConversationMuted: jest.fn() };
    const useCase = new SetConversationMutedUseCase({ ...deps, messagingRealtime });

    const result = await useCase.execute({ requester: buildRequester(), conversationId: 10, muted: true });

    expect(deps.conversationRepository.setMuted).toHaveBeenCalledWith(10, 1, true);
    expect(messagingRealtime.notifyConversationMuted).toHaveBeenCalledWith(1, 10, true);
    expect(result).toEqual({ conversationId: 10, muted: true });
  });

  it('unmutes the conversation when muted is false', async () => {
    const deps = buildDeps();
    const useCase = new SetConversationMutedUseCase(deps);

    const result = await useCase.execute({ requester: buildRequester(), conversationId: 10, muted: false });

    expect(deps.conversationRepository.setMuted).toHaveBeenCalledWith(10, 1, false);
    expect(result).toEqual({ conversationId: 10, muted: false });
  });
});
