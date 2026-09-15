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

  describe('attachment validation', () => {
    it('persists the sniffed mime/size instead of the caller-supplied values', async () => {
      const repos = buildRepos();
      repos.messageRepository.create.mockResolvedValue({ id: 200, type: 'image' });
      const attachmentStorageService = {
        validateUploadedFile: jest.fn().mockResolvedValue({ mime: 'image/png', sizeBytes: 1234 }),
        delete: jest.fn(),
      };
      const useCase = new SendMessageUseCase({ ...repos, attachmentStorageService });

      await useCase.execute({
        requester: buildRequester(),
        conversationId: 10,
        type: 'image',
        attachment: { key: 'abc.png', originalName: 'photo.png', mime: 'application/octet-stream', sizeBytes: 999 },
      });

      expect(attachmentStorageService.validateUploadedFile).toHaveBeenCalledWith(10, 'abc.png', 'image');
      expect(repos.messageRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ attachmentMime: 'image/png', attachmentSizeBytes: 1234 })
      );
      expect(attachmentStorageService.delete).not.toHaveBeenCalled();
    });

    it('deletes the uploaded file and rejects the message when validation fails', async () => {
      const repos = buildRepos();
      const attachmentStorageService = {
        validateUploadedFile: jest.fn().mockRejectedValue(new Error('does not look like a valid image')),
        delete: jest.fn().mockResolvedValue(undefined),
      };
      const useCase = new SendMessageUseCase({ ...repos, attachmentStorageService });

      await expect(
        useCase.execute({
          requester: buildRequester(),
          conversationId: 10,
          type: 'image',
          attachment: { key: 'abc.png', originalName: 'photo.png' },
        })
      ).rejects.toThrow('does not look like a valid image');

      expect(attachmentStorageService.delete).toHaveBeenCalledWith(10, 'abc.png');
      expect(repos.messageRepository.create).not.toHaveBeenCalled();
    });
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

  it('broadcasts the persisted message to the conversation room in real time', async () => {
    const repos = buildRepos();
    const messagingRealtime = { broadcastMessage: jest.fn() };
    const useCase = new SendMessageUseCase({ ...repos, messagingRealtime });

    await useCase.execute({ requester: buildRequester(), conversationId: 10, body: 'hello' });
    expect(messagingRealtime.broadcastMessage).toHaveBeenCalledWith(10, { id: 100, body: 'hello' });
  });

  describe('notifyOfflineParticipants', () => {
    function buildRealtimeDeps() {
      return {
        presenceStore: { isOnline: jest.fn().mockResolvedValue(false) },
        pushSubscriptionRepository: {
          listByUserId: jest.fn().mockResolvedValue([{ endpoint: 'https://push.example/a', p256dh: 'k', auth: 'a' }]),
          deleteByEndpointForUser: jest.fn().mockResolvedValue(undefined),
        },
        webPushService: { send: jest.fn().mockResolvedValue(undefined) },
      };
    }

    it('does nothing when realtime dependencies are not configured', async () => {
      const useCase = new SendMessageUseCase(buildRepos());
      await expect(useCase.notifyOfflineParticipants(10, buildRequester(), { type: 'text', body: 'hi' })).resolves.toBeUndefined();
    });

    it('pushes to a participant who is not currently online, skipping the sender', async () => {
      const repos = buildRepos();
      const realtime = buildRealtimeDeps();
      repos.conversationRepository.listParticipants = jest
        .fn()
        .mockResolvedValue([{ userId: 1 }, { userId: 2 }]);
      const useCase = new SendMessageUseCase({ ...repos, ...realtime });

      await useCase.notifyOfflineParticipants(10, buildRequester({ firstname: 'Mona', lastname: 'Manager' }), {
        type: 'text',
        body: 'hi there',
      });

      expect(realtime.presenceStore.isOnline).toHaveBeenCalledWith(2);
      expect(realtime.presenceStore.isOnline).not.toHaveBeenCalledWith(1);
      expect(realtime.pushSubscriptionRepository.listByUserId).toHaveBeenCalledWith(2);
      expect(realtime.webPushService.send).toHaveBeenCalledWith(
        expect.objectContaining({ endpoint: 'https://push.example/a' }),
        expect.objectContaining({ title: 'Mona Manager', body: 'hi there' })
      );
    });

    it('skips a participant who is currently online', async () => {
      const repos = buildRepos();
      const realtime = buildRealtimeDeps();
      realtime.presenceStore.isOnline.mockResolvedValue(true);
      repos.conversationRepository.listParticipants = jest.fn().mockResolvedValue([{ userId: 1 }, { userId: 2 }]);
      const useCase = new SendMessageUseCase({ ...repos, ...realtime });

      await useCase.notifyOfflineParticipants(10, buildRequester(), { type: 'text', body: 'hi' });
      expect(realtime.pushSubscriptionRepository.listByUserId).not.toHaveBeenCalled();
    });

    it('prunes an expired push subscription instead of throwing', async () => {
      const repos = buildRepos();
      const realtime = buildRealtimeDeps();
      realtime.webPushService.send.mockRejectedValue(Object.assign(new Error('gone'), { expired: true }));
      repos.conversationRepository.listParticipants = jest.fn().mockResolvedValue([{ userId: 1 }, { userId: 2 }]);
      const useCase = new SendMessageUseCase({ ...repos, ...realtime });

      await expect(
        useCase.notifyOfflineParticipants(10, buildRequester(), { type: 'text', body: 'hi' })
      ).resolves.toBeUndefined();
      expect(realtime.pushSubscriptionRepository.deleteByEndpointForUser).toHaveBeenCalledWith(
        'https://push.example/a',
        2
      );
    });

    it('uses a generic attachment label for the push body on non-text messages', async () => {
      const repos = buildRepos();
      const realtime = buildRealtimeDeps();
      repos.conversationRepository.listParticipants = jest.fn().mockResolvedValue([{ userId: 1 }, { userId: 2 }]);
      const useCase = new SendMessageUseCase({ ...repos, ...realtime });

      await useCase.notifyOfflineParticipants(10, buildRequester(), { type: 'voice', body: null });
      expect(realtime.webPushService.send).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ body: 'Sent a voice message' })
      );
    });
  });
});
