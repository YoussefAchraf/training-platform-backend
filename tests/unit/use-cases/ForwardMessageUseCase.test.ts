import { ForwardMessageUseCase } from '../../../src/use-cases/messaging/ForwardMessageUseCase';

function buildRequester(overrides: Record<string, any> = {}) {
  return {
    id: 1,
    roleName: 'Manager',
    isSuperAdmin: () => false,
    ...overrides,
  };
}

function buildDeps() {
  return {
    conversationRepository: {
      isParticipant: jest.fn().mockResolvedValue(true),
      listParticipants: jest.fn().mockResolvedValue([{ userId: 1 }, { userId: 2 }]),
    },
    messageRepository: {
      findById: jest.fn().mockResolvedValue({
        id: 5,
        conversationId: 10,
        type: 'text',
        body: 'Hello there',
        attachmentKey: null,
        attachmentOriginalName: null,
        attachmentMime: null,
        attachmentSizeBytes: null,
        attachmentDurationSeconds: null,
      }),
      create: jest.fn().mockResolvedValue({ id: 100, conversationId: 20, type: 'text', body: 'Hello there' }),
    },
  };
}

describe('ForwardMessageUseCase', () => {
  it('rejects a SuperAdmin requester', async () => {
    const deps = buildDeps();
    const useCase = new ForwardMessageUseCase(deps);

    await expect(
      useCase.execute({ requester: buildRequester({ isSuperAdmin: () => true }), messageId: 5, targetConversationId: 20 })
    ).rejects.toThrow('SuperAdmin cannot access messaging');
    expect(deps.messageRepository.findById).not.toHaveBeenCalled();
  });

  it('rejects a requester outside the messaging allow-list', async () => {
    const deps = buildDeps();
    const useCase = new ForwardMessageUseCase(deps);

    await expect(
      useCase.execute({ requester: buildRequester({ roleName: 'Sales' }), messageId: 5, targetConversationId: 20 })
    ).rejects.toThrow('Only Manager and Instructor');
  });

  it('rejects a message that does not exist', async () => {
    const deps = buildDeps();
    deps.messageRepository.findById.mockResolvedValue(null);
    const useCase = new ForwardMessageUseCase(deps);

    await expect(useCase.execute({ requester: buildRequester(), messageId: 5, targetConversationId: 20 })).rejects.toThrow(
      'Message not found'
    );
  });

  it('rejects a requester who is not a participant of the source conversation', async () => {
    const deps = buildDeps();
    deps.conversationRepository.isParticipant.mockImplementation((conversationId) =>
      Promise.resolve(conversationId !== 10)
    );
    const useCase = new ForwardMessageUseCase(deps);

    await expect(useCase.execute({ requester: buildRequester(), messageId: 5, targetConversationId: 20 })).rejects.toThrow(
      'source conversation'
    );
  });

  it('rejects a requester who is not a participant of the target conversation', async () => {
    const deps = buildDeps();
    deps.conversationRepository.isParticipant.mockImplementation((conversationId) =>
      Promise.resolve(conversationId !== 20)
    );
    const useCase = new ForwardMessageUseCase(deps);

    await expect(useCase.execute({ requester: buildRequester(), messageId: 5, targetConversationId: 20 })).rejects.toThrow(
      'target conversation'
    );
    expect(deps.messageRepository.create).not.toHaveBeenCalled();
  });

  it('copies the message content into the target conversation without a reply link', async () => {
    const deps = buildDeps();
    const useCase = new ForwardMessageUseCase(deps);

    await useCase.execute({ requester: buildRequester(), messageId: 5, targetConversationId: 20 });
    expect(deps.messageRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        conversationId: 20,
        senderId: 1,
        type: 'text',
        body: 'Hello there',
        replyToMessageId: null,
      })
    );
  });

  it('broadcasts the forwarded message in real time', async () => {
    const deps = buildDeps();
    const messagingRealtime = { broadcastMessage: jest.fn() };
    const useCase = new ForwardMessageUseCase({ ...deps, messagingRealtime });

    await useCase.execute({ requester: buildRequester(), messageId: 5, targetConversationId: 20 });
    expect(messagingRealtime.broadcastMessage).toHaveBeenCalledWith(20, expect.objectContaining({ id: 100 }));
  });
});
