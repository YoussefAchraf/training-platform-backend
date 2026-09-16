import { AddParticipantUseCase } from '../../../src/use-cases/messaging/AddParticipantUseCase';

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
        participants: [{ userId: 1, role: 'owner' }, { userId: 3, role: 'member' }],
      }),
      addParticipant: jest.fn().mockResolvedValue({ userId: 2, role: 'member' }),
    },
    userRepository: {
      findById: jest.fn().mockImplementation((id) =>
        Promise.resolve({ id, roleName: 'Instructor', isApproved: () => true, isSuperAdmin: () => false })
      ),
    },
  };
}

describe('AddParticipantUseCase', () => {
  it('rejects a SuperAdmin requester', async () => {
    const repos = buildRepos();
    const useCase = new AddParticipantUseCase(repos);

    await expect(
      useCase.execute({ requester: buildRequester({ isSuperAdmin: () => true }), conversationId: 10, userId: 2 })
    ).rejects.toThrow('SuperAdmin cannot access messaging');
  });

  it('rejects a non-Manager requester', async () => {
    const repos = buildRepos();
    const useCase = new AddParticipantUseCase(repos);

    await expect(
      useCase.execute({ requester: buildRequester({ isManager: () => false }), conversationId: 10, userId: 2 })
    ).rejects.toThrow('Only a Manager');
  });

  it('rejects a Manager who is not the group owner', async () => {
    const repos = buildRepos();
    const useCase = new AddParticipantUseCase(repos);

    await expect(
      useCase.execute({ requester: buildRequester({ id: 3 }), conversationId: 10, userId: 2 })
    ).rejects.toThrow('Only the group owner');
    expect(repos.conversationRepository.addParticipant).not.toHaveBeenCalled();
  });

  it('rejects adding a SuperAdmin as a participant', async () => {
    const repos = buildRepos();
    repos.userRepository.findById.mockResolvedValue({ id: 2, roleName: 'SuperAdmin', isApproved: () => true, isSuperAdmin: () => true });
    const useCase = new AddParticipantUseCase(repos);

    await expect(useCase.execute({ requester: buildRequester(), conversationId: 10, userId: 2 })).rejects.toThrow(
      'cannot be added to messaging'
    );
  });

  it('rejects adding a user who is already a participant', async () => {
    const repos = buildRepos();
    const useCase = new AddParticipantUseCase(repos);

    await expect(useCase.execute({ requester: buildRequester(), conversationId: 10, userId: 3 })).rejects.toThrow(
      'already in the group'
    );
  });

  it('adds the participant when the requester is the group owner', async () => {
    const repos = buildRepos();
    const useCase = new AddParticipantUseCase(repos);

    await useCase.execute({ requester: buildRequester(), conversationId: 10, userId: 2 });
    expect(repos.conversationRepository.addParticipant).toHaveBeenCalledWith(10, 2, 'member');
  });

  it('notifies the new participant in real time without failing the request if that notification errors', async () => {
    const repos = buildRepos();
    const messagingRealtime = { notifyParticipantAdded: jest.fn().mockRejectedValue(new Error('socket down')) };
    const useCase = new AddParticipantUseCase({ ...repos, messagingRealtime });

    await expect(useCase.execute({ requester: buildRequester(), conversationId: 10, userId: 2 })).resolves.toBeDefined();
    expect(messagingRealtime.notifyParticipantAdded).toHaveBeenCalledWith(
      10,
      expect.objectContaining({ id: 10 }),
      { userId: 2, role: 'member' }
    );
  });
});
