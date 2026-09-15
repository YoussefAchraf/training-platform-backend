import { RemoveParticipantUseCase } from '../../../src/use-cases/messaging/RemoveParticipantUseCase';

function buildRequester(overrides: Record<string, any> = {}) {
  return {
    id: 1,
    isSuperAdmin: () => false,
    isManager: () => true,
    ...overrides,
  };
}

function buildRepos() {
  return {
    conversationRepository: {
      findById: jest.fn().mockResolvedValue({
        id: 10,
        type: 'group',
        participants: [{ userId: 1, role: 'owner' }, { userId: 2, role: 'member' }],
      }),
      removeParticipant: jest.fn().mockResolvedValue(undefined),
    },
  };
}

describe('RemoveParticipantUseCase', () => {
  it('rejects a SuperAdmin requester', async () => {
    const repos = buildRepos();
    const useCase = new RemoveParticipantUseCase(repos);

    await expect(
      useCase.execute({ requester: buildRequester({ isSuperAdmin: () => true }), conversationId: 10, userId: 2 })
    ).rejects.toThrow('SuperAdmin cannot access messaging');
  });

  it('rejects a non-owner Manager', async () => {
    const repos = buildRepos();
    const useCase = new RemoveParticipantUseCase(repos);

    await expect(
      useCase.execute({ requester: buildRequester({ id: 2 }), conversationId: 10, userId: 1 })
    ).rejects.toThrow('Only the group owner');
  });

  it('rejects removing the owner', async () => {
    const repos = buildRepos();
    const useCase = new RemoveParticipantUseCase(repos);

    await expect(useCase.execute({ requester: buildRequester(), conversationId: 10, userId: 1 })).rejects.toThrow(
      'owner cannot be removed'
    );
    expect(repos.conversationRepository.removeParticipant).not.toHaveBeenCalled();
  });

  it('removes a member when requested by the owner', async () => {
    const repos = buildRepos();
    const useCase = new RemoveParticipantUseCase(repos);

    await useCase.execute({ requester: buildRequester(), conversationId: 10, userId: 2 });
    expect(repos.conversationRepository.removeParticipant).toHaveBeenCalledWith(10, 2);
  });

  it('notifies the removal in real time', async () => {
    const repos = buildRepos();
    const messagingRealtime = { notifyParticipantRemoved: jest.fn().mockResolvedValue(undefined) };
    const useCase = new RemoveParticipantUseCase({ ...repos, messagingRealtime });

    await useCase.execute({ requester: buildRequester(), conversationId: 10, userId: 2 });
    expect(messagingRealtime.notifyParticipantRemoved).toHaveBeenCalledWith(10, 2);
  });
});
