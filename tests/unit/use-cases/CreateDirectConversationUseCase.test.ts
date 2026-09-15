import { CreateDirectConversationUseCase } from '../../../src/use-cases/messaging/CreateDirectConversationUseCase';

function buildRequester(overrides: Record<string, any> = {}) {
  return {
    id: 1,
    roleName: 'Manager',
    isSuperAdmin: () => false,
    ...overrides,
  };
}

function buildRepos() {
  return {
    conversationRepository: {
      findDirectConversationBetween: jest.fn().mockResolvedValue(null),
      createDirect: jest.fn().mockResolvedValue({ id: 10, type: 'direct' }),
    },
    userRepository: {
      findById: jest.fn().mockResolvedValue({
        id: 2,
        roleName: 'Instructor',
        isApproved: () => true,
        isSuperAdmin: () => false,
      }),
    },
  };
}

describe('CreateDirectConversationUseCase', () => {
  it('rejects a SuperAdmin requester', async () => {
    const repos = buildRepos();
    const useCase = new CreateDirectConversationUseCase(repos);

    await expect(
      useCase.execute({ requester: buildRequester({ isSuperAdmin: () => true }), targetUserId: 2 })
    ).rejects.toThrow('SuperAdmin cannot access messaging');
    expect(repos.conversationRepository.findDirectConversationBetween).not.toHaveBeenCalled();
  });

  it('rejects a requester whose role is not Manager or Instructor', async () => {
    const repos = buildRepos();
    const useCase = new CreateDirectConversationUseCase(repos);

    await expect(
      useCase.execute({ requester: buildRequester({ roleName: 'Sales' }), targetUserId: 2 })
    ).rejects.toThrow('Only Manager and Instructor');
  });

  it('rejects messaging yourself', async () => {
    const repos = buildRepos();
    const useCase = new CreateDirectConversationUseCase(repos);

    await expect(useCase.execute({ requester: buildRequester({ id: 2 }), targetUserId: 2 })).rejects.toThrow(
      'valid target user'
    );
  });

  it('rejects a target user that is SuperAdmin', async () => {
    const repos = buildRepos();
    repos.userRepository.findById.mockResolvedValue({ id: 2, roleName: 'SuperAdmin', isApproved: () => true, isSuperAdmin: () => true });
    const useCase = new CreateDirectConversationUseCase(repos);

    await expect(useCase.execute({ requester: buildRequester(), targetUserId: 2 })).rejects.toThrow('cannot be messaged');
    expect(repos.conversationRepository.createDirect).not.toHaveBeenCalled();
  });

  it('rejects a target user outside the messaging allow-list (e.g. Sales)', async () => {
    const repos = buildRepos();
    repos.userRepository.findById.mockResolvedValue({ id: 2, roleName: 'Sales', isApproved: () => true, isSuperAdmin: () => false });
    const useCase = new CreateDirectConversationUseCase(repos);

    await expect(useCase.execute({ requester: buildRequester(), targetUserId: 2 })).rejects.toThrow('cannot be messaged');
  });

  it('reuses an existing direct conversation instead of creating a duplicate', async () => {
    const repos = buildRepos();
    repos.conversationRepository.findDirectConversationBetween.mockResolvedValue({ id: 99, type: 'direct' });
    const useCase = new CreateDirectConversationUseCase(repos);

    const result = await useCase.execute({ requester: buildRequester(), targetUserId: 2 });
    expect(result).toEqual({ id: 99, type: 'direct' });
    expect(repos.conversationRepository.createDirect).not.toHaveBeenCalled();
  });

  it('creates a new direct conversation between the two users when none exists', async () => {
    const repos = buildRepos();
    const useCase = new CreateDirectConversationUseCase(repos);

    await useCase.execute({ requester: buildRequester(), targetUserId: 2 });
    expect(repos.conversationRepository.createDirect).toHaveBeenCalledWith({ createdBy: 1, participantUserIds: [1, 2] });
  });
});
