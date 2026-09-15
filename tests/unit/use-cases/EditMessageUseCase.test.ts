import { EditMessageUseCase } from '../../../src/use-cases/messaging/EditMessageUseCase';

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
    },
    messageRepository: {
      findById: jest.fn().mockResolvedValue({
        id: 5,
        conversationId: 10,
        senderId: 1,
        type: 'text',
        body: 'Original text',
      }),
      update: jest.fn().mockResolvedValue({ id: 5, conversationId: 10, senderId: 1, type: 'text', body: 'Updated text' }),
    },
  };
}

describe('EditMessageUseCase', () => {
  it('rejects a SuperAdmin requester', async () => {
    const deps = buildDeps();
    const useCase = new EditMessageUseCase(deps);

    await expect(
      useCase.execute({ requester: buildRequester({ isSuperAdmin: () => true }), messageId: 5, body: 'Updated text' })
    ).rejects.toThrow('SuperAdmin cannot access messaging');
    expect(deps.messageRepository.findById).not.toHaveBeenCalled();
  });

  it('rejects a message that does not exist', async () => {
    const deps = buildDeps();
    deps.messageRepository.findById.mockResolvedValue(null);
    const useCase = new EditMessageUseCase(deps);

    await expect(useCase.execute({ requester: buildRequester(), messageId: 5, body: 'Updated text' })).rejects.toThrow(
      'Message not found'
    );
  });

  it('rejects a requester who is not a participant', async () => {
    const deps = buildDeps();
    deps.conversationRepository.isParticipant.mockResolvedValue(false);
    const useCase = new EditMessageUseCase(deps);

    await expect(useCase.execute({ requester: buildRequester(), messageId: 5, body: 'Updated text' })).rejects.toThrow(
      'not a participant'
    );
  });

  it('rejects a requester who is not the original sender', async () => {
    const deps = buildDeps();
    const useCase = new EditMessageUseCase(deps);

    await expect(
      useCase.execute({ requester: buildRequester({ id: 2 }), messageId: 5, body: 'Updated text' })
    ).rejects.toThrow('only edit your own messages');
    expect(deps.messageRepository.update).not.toHaveBeenCalled();
  });

  it('rejects editing a non-text message', async () => {
    const deps = buildDeps();
    deps.messageRepository.findById.mockResolvedValue({ id: 5, conversationId: 10, senderId: 1, type: 'image', body: null });
    const useCase = new EditMessageUseCase(deps);

    await expect(useCase.execute({ requester: buildRequester(), messageId: 5, body: 'Updated text' })).rejects.toThrow(
      'Only text messages can be edited'
    );
  });

  it('rejects an empty body', async () => {
    const deps = buildDeps();
    const useCase = new EditMessageUseCase(deps);

    await expect(useCase.execute({ requester: buildRequester(), messageId: 5, body: '   ' })).rejects.toThrow(
      'Message body is required'
    );
    expect(deps.messageRepository.update).not.toHaveBeenCalled();
  });

  it('updates the message body and broadcasts the change', async () => {
    const deps = buildDeps();
    const messagingRealtime = { broadcastMessageUpdated: jest.fn() };
    const useCase = new EditMessageUseCase({ ...deps, messagingRealtime });

    const result = await useCase.execute({ requester: buildRequester(), messageId: 5, body: '  Updated text  ' });

    expect(deps.messageRepository.update).toHaveBeenCalledWith(5, { body: 'Updated text' });
    expect(result).toEqual(expect.objectContaining({ id: 5, body: 'Updated text' }));
    expect(messagingRealtime.broadcastMessageUpdated).toHaveBeenCalledWith(
      10,
      expect.objectContaining({ id: 5, body: 'Updated text' })
    );
  });
});
