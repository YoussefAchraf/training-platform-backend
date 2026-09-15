import { DeleteMessageUseCase } from '../../../src/use-cases/messaging/DeleteMessageUseCase';

function buildRequester(overrides: Record<string, any> = {}) {
  return {
    id: 1,
    isSuperAdmin: () => false,
    ...overrides,
  };
}

function buildDeps(overrides: Record<string, any> = {}) {
  return {
    conversationRepository: {
      isParticipant: jest.fn().mockResolvedValue(true),
    },
    messageRepository: {
      findById: jest.fn().mockResolvedValue({
        id: 5,
        conversationId: 10,
        senderId: 1,
        type: 'text',
        body: 'Hello',
        attachmentKey: null,
        createdAt: new Date().toISOString(),
      }),
      softDeleteForEveryone: jest.fn().mockResolvedValue({ id: 5, conversationId: 10, deletedAt: new Date().toISOString() }),
      hideForUser: jest.fn().mockResolvedValue(undefined),
    },
    attachmentStorageService: { delete: jest.fn().mockResolvedValue(undefined) },
    ...overrides,
  };
}

describe('DeleteMessageUseCase', () => {
  it('rejects a SuperAdmin requester', async () => {
    const deps = buildDeps();
    const useCase = new DeleteMessageUseCase(deps);

    await expect(
      useCase.execute({ requester: buildRequester({ isSuperAdmin: () => true }), messageId: 5, scope: 'me' })
    ).rejects.toThrow('SuperAdmin cannot access messaging');
    expect(deps.messageRepository.findById).not.toHaveBeenCalled();
  });

  it('rejects an invalid scope', async () => {
    const deps = buildDeps();
    const useCase = new DeleteMessageUseCase(deps);

    await expect(useCase.execute({ requester: buildRequester(), messageId: 5, scope: 'everyone-else' as any })).rejects.toThrow(
      'Invalid delete scope'
    );
  });

  it('rejects a message that does not exist', async () => {
    const deps = buildDeps();
    deps.messageRepository.findById.mockResolvedValue(null);
    const useCase = new DeleteMessageUseCase(deps);

    await expect(useCase.execute({ requester: buildRequester(), messageId: 5, scope: 'me' })).rejects.toThrow(
      'Message not found'
    );
  });

  it('rejects a requester who is not a participant', async () => {
    const deps = buildDeps();
    deps.conversationRepository.isParticipant.mockResolvedValue(false);
    const useCase = new DeleteMessageUseCase(deps);

    await expect(useCase.execute({ requester: buildRequester(), messageId: 5, scope: 'me' })).rejects.toThrow(
      'not a participant'
    );
  });

  it('hides the message for the requester only when scope is "me", regardless of sender', async () => {
    const deps = buildDeps();
    const messagingRealtime = { notifyMessageHiddenForUser: jest.fn() };
    const useCase = new DeleteMessageUseCase({ ...deps, messagingRealtime });

    await useCase.execute({ requester: buildRequester({ id: 2 }), messageId: 5, scope: 'me' });

    expect(deps.messageRepository.hideForUser).toHaveBeenCalledWith(5, 2);
    expect(deps.messageRepository.softDeleteForEveryone).not.toHaveBeenCalled();
    expect(messagingRealtime.notifyMessageHiddenForUser).toHaveBeenCalledWith(2, 10, 5);
  });

  it('rejects "everyone" scope from anyone but the original sender', async () => {
    const deps = buildDeps();
    const useCase = new DeleteMessageUseCase(deps);

    await expect(
      useCase.execute({ requester: buildRequester({ id: 2 }), messageId: 5, scope: 'everyone' })
    ).rejects.toThrow('only delete your own messages for everyone');
    expect(deps.messageRepository.softDeleteForEveryone).not.toHaveBeenCalled();
  });

  it('rejects "everyone" scope once the 2-minute window has elapsed', async () => {
    const deps = buildDeps();
    deps.messageRepository.findById.mockResolvedValue({
      id: 5,
      conversationId: 10,
      senderId: 1,
      type: 'text',
      body: 'Hello',
      attachmentKey: null,
      createdAt: new Date(Date.now() - 3 * 60 * 1000).toISOString(),
    });
    const useCase = new DeleteMessageUseCase(deps);

    await expect(useCase.execute({ requester: buildRequester(), messageId: 5, scope: 'everyone' })).rejects.toThrow(
      'can no longer be deleted for everyone'
    );
    expect(deps.messageRepository.softDeleteForEveryone).not.toHaveBeenCalled();
  });

  it('soft-deletes for everyone within the window and broadcasts it', async () => {
    const deps = buildDeps();
    const messagingRealtime = { broadcastMessageDeleted: jest.fn() };
    const useCase = new DeleteMessageUseCase({ ...deps, messagingRealtime });

    await useCase.execute({ requester: buildRequester(), messageId: 5, scope: 'everyone' });

    expect(deps.messageRepository.softDeleteForEveryone).toHaveBeenCalledWith(5);
    expect(messagingRealtime.broadcastMessageDeleted).toHaveBeenCalledWith(10, 5, 'everyone');
  });

  it('cleans up the attachment file when deleting an attachment message for everyone', async () => {
    const deps = buildDeps();
    deps.messageRepository.findById.mockResolvedValue({
      id: 5,
      conversationId: 10,
      senderId: 1,
      type: 'image',
      body: null,
      attachmentKey: 'abc.png',
      createdAt: new Date().toISOString(),
    });
    const useCase = new DeleteMessageUseCase(deps);

    await useCase.execute({ requester: buildRequester(), messageId: 5, scope: 'everyone' });
    await Promise.resolve();

    expect(deps.attachmentStorageService.delete).toHaveBeenCalledWith(10, 'abc.png');
  });
});
