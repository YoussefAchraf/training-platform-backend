import { DownloadAttachmentUseCase } from '../../../src/use-cases/messaging/DownloadAttachmentUseCase';

function buildRequester(overrides: Record<string, any> = {}) {
  return {
    id: 1,
    isSuperAdmin: () => false,
    ...overrides,
  };
}

function buildRepos() {
  return {
    conversationRepository: { isParticipant: jest.fn().mockResolvedValue(true) },
    messageRepository: {
      findById: jest.fn().mockResolvedValue({ id: 5, conversationId: 10, attachmentKey: 'abc.png' }),
    },
  };
}

describe('DownloadAttachmentUseCase', () => {
  it('rejects a SuperAdmin requester', async () => {
    const repos = buildRepos();
    const useCase = new DownloadAttachmentUseCase(repos);

    await expect(useCase.execute({ requester: buildRequester({ isSuperAdmin: () => true }), messageId: 5 })).rejects.toThrow(
      'SuperAdmin cannot access messaging'
    );
    expect(repos.messageRepository.findById).not.toHaveBeenCalled();
  });

  it('rejects a message with no attachment', async () => {
    const repos = buildRepos();
    repos.messageRepository.findById.mockResolvedValue({ id: 5, conversationId: 10, attachmentKey: null });
    const useCase = new DownloadAttachmentUseCase(repos);

    await expect(useCase.execute({ requester: buildRequester(), messageId: 5 })).rejects.toThrow('Attachment not found');
  });

  it('rejects a requester who is not a participant of the message\'s conversation', async () => {
    const repos = buildRepos();
    repos.conversationRepository.isParticipant.mockResolvedValue(false);
    const useCase = new DownloadAttachmentUseCase(repos);

    await expect(useCase.execute({ requester: buildRequester(), messageId: 5 })).rejects.toThrow('not a participant');
  });

  it('returns the message for a participant', async () => {
    const repos = buildRepos();
    const useCase = new DownloadAttachmentUseCase(repos);

    const result = await useCase.execute({ requester: buildRequester(), messageId: 5 });
    expect(result).toEqual({ id: 5, conversationId: 10, attachmentKey: 'abc.png' });
    expect(repos.conversationRepository.isParticipant).toHaveBeenCalledWith(10, 1);
  });
});
