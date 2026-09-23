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
      unhideConversation: jest.fn().mockResolvedValue(undefined),
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
    const existing = { id: 99, type: 'direct', participants: [{ userId: 1, hiddenAt: null }, { userId: 2, hiddenAt: null }] };
    repos.conversationRepository.findDirectConversationBetween.mockResolvedValue(existing);
    const useCase = new CreateDirectConversationUseCase(repos);

    const result = await useCase.execute({ requester: buildRequester(), targetUserId: 2 });
    expect(result).toBe(existing);
    expect(repos.conversationRepository.createDirect).not.toHaveBeenCalled();
  });

  it('creates a new direct conversation between the two users when none exists', async () => {
    const repos = buildRepos();
    const useCase = new CreateDirectConversationUseCase(repos);

    await useCase.execute({ requester: buildRequester(), targetUserId: 2 });
    expect(repos.conversationRepository.createDirect).toHaveBeenCalledWith({ createdBy: 1, participantUserIds: [1, 2] });
  });

  it("tells the realtime gateway about a newly created conversation so both users' open sockets join its room", async () => {
    const repos = buildRepos();
    const created = { id: 10, type: 'direct', participants: [{ userId: 1 }, { userId: 2 }] };
    repos.conversationRepository.createDirect.mockResolvedValue(created);
    const messagingRealtime = { notifyDirectCreated: jest.fn().mockResolvedValue(undefined) };
    const useCase = new CreateDirectConversationUseCase({ ...repos, messagingRealtime });

    const result = await useCase.execute({ requester: buildRequester(), targetUserId: 2 });

    expect(result).toBe(created);
    expect(messagingRealtime.notifyDirectCreated).toHaveBeenCalledWith(created, 1);
  });

  it('does not notify anyone when an existing conversation is reused', async () => {
    const repos = buildRepos();
    repos.conversationRepository.findDirectConversationBetween.mockResolvedValue({
      id: 99,
      type: 'direct',
      participants: [{ userId: 1, hiddenAt: null }, { userId: 2, hiddenAt: null }],
    });
    const messagingRealtime = { notifyDirectCreated: jest.fn().mockResolvedValue(undefined) };
    const useCase = new CreateDirectConversationUseCase({ ...repos, messagingRealtime });

    await useCase.execute({ requester: buildRequester(), targetUserId: 2 });

    expect(messagingRealtime.notifyDirectCreated).not.toHaveBeenCalled();
  });

  it('unhides a reused conversation for the requester when they had previously hidden it', async () => {
    const repos = buildRepos();
    const existing = {
      id: 99,
      type: 'direct',
      participants: [
        { userId: 1, hiddenAt: '2026-01-01T00:00:00.000Z' },
        { userId: 2, hiddenAt: '2025-06-01T00:00:00.000Z' },
      ],
    };
    repos.conversationRepository.findDirectConversationBetween.mockResolvedValue(existing);

    const useCase = new CreateDirectConversationUseCase(repos);
    const result = await useCase.execute({ requester: buildRequester(), targetUserId: 2 });

    expect(repos.conversationRepository.unhideConversation).toHaveBeenCalledWith(99, 1);
    expect(result.participants.find((p: any) => p.userId === 1).hiddenAt).toBeNull();
    
    expect(result.participants.find((p: any) => p.userId === 2).hiddenAt).toBe('2025-06-01T00:00:00.000Z');
  });

  it('does not touch hidden state when the requester had not hidden the reused conversation', async () => {
    const repos = buildRepos();
    repos.conversationRepository.findDirectConversationBetween.mockResolvedValue({
      id: 99,
      type: 'direct',
      participants: [{ userId: 1, hiddenAt: null }, { userId: 2, hiddenAt: '2026-01-01T00:00:00.000Z' }],
    });

    const useCase = new CreateDirectConversationUseCase(repos);
    const result = await useCase.execute({ requester: buildRequester(), targetUserId: 2 });

    expect(repos.conversationRepository.unhideConversation).not.toHaveBeenCalled();
    
    expect(result.participants.find((p: any) => p.userId === 2).hiddenAt).toBe('2026-01-01T00:00:00.000Z');
  });

  it('still returns the conversation when the realtime notification fails', async () => {
    const repos = buildRepos();
    const created = { id: 10, type: 'direct', participants: [{ userId: 1 }, { userId: 2 }] };
    repos.conversationRepository.createDirect.mockResolvedValue(created);
    const messagingRealtime = { notifyDirectCreated: jest.fn().mockRejectedValue(new Error('socket layer down')) };
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const useCase = new CreateDirectConversationUseCase({ ...repos, messagingRealtime });

    const result = await useCase.execute({ requester: buildRequester(), targetUserId: 2 });
    await new Promise((resolve) => setImmediate(resolve));

    expect(result).toBe(created);
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to notify participants'), 'socket layer down');
    errorSpy.mockRestore();
  });
});
