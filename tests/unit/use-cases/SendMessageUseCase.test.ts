import { SendMessageUseCase } from '../../../src/use-cases/messaging/SendMessageUseCase';

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
      isParticipant: jest.fn().mockResolvedValue(true),
    },
    messageRepository: {
      create: jest.fn().mockResolvedValue({ id: 100, body: 'hello' }),
      findById: jest.fn().mockResolvedValue({ id: 5, conversationId: 10 }),
    },
  };
}

describe('SendMessageUseCase', () => {
  it('rejects a SuperAdmin requester', async () => {
    const repos = buildRepos();
    const useCase = new SendMessageUseCase(repos);

    await expect(
      useCase.execute({ requester: buildRequester({ isSuperAdmin: () => true }), conversationId: 10, body: 'hi' })
    ).rejects.toThrow('SuperAdmin cannot access messaging');
    expect(repos.conversationRepository.isParticipant).not.toHaveBeenCalled();
  });

  it('rejects a requester outside the messaging allow-list', async () => {
    const repos = buildRepos();
    const useCase = new SendMessageUseCase(repos);

    await expect(
      useCase.execute({ requester: buildRequester({ roleName: 'Sales' }), conversationId: 10, body: 'hi' })
    ).rejects.toThrow('Only Manager and Instructor');
  });

  it('rejects sending into a conversation the requester is not part of', async () => {
    const repos = buildRepos();
    repos.conversationRepository.isParticipant.mockResolvedValue(false);
    const useCase = new SendMessageUseCase(repos);

    await expect(useCase.execute({ requester: buildRequester(), conversationId: 10, body: 'hi' })).rejects.toThrow(
      'not a participant'
    );
    expect(repos.messageRepository.create).not.toHaveBeenCalled();
  });

  it('rejects an empty text message', async () => {
    const repos = buildRepos();
    const useCase = new SendMessageUseCase(repos);

    await expect(useCase.execute({ requester: buildRequester(), conversationId: 10, body: '   ' })).rejects.toThrow(
      'Message body is required'
    );
  });

  it('rejects a non-text message with no attachment', async () => {
    const repos = buildRepos();
    const useCase = new SendMessageUseCase(repos);

    await expect(useCase.execute({ requester: buildRequester(), conversationId: 10, type: 'image' })).rejects.toThrow(
      'attachment is required'
    );
  });

  it('rejects replying to a message from a different conversation', async () => {
    const repos = buildRepos();
    repos.messageRepository.findById.mockResolvedValue({ id: 5, conversationId: 99 });
    const useCase = new SendMessageUseCase(repos);

    await expect(
      useCase.execute({ requester: buildRequester(), conversationId: 10, body: 'hi', replyToMessageId: 5 })
    ).rejects.toThrow('not found in this conversation');
  });

  it('persists a valid text message', async () => {
    const repos = buildRepos();
    const useCase = new SendMessageUseCase(repos);

    const result = await useCase.execute({ requester: buildRequester(), conversationId: 10, body: '  hello  ' });
    expect(result).toEqual({ id: 100, body: 'hello' });
    expect(repos.messageRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ conversationId: 10, senderId: 1, type: 'text', body: 'hello' })
    );
  });
});
