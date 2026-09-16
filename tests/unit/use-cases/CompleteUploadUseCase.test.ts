import { CompleteUploadUseCase } from '../../../src/use-cases/messaging/CompleteUploadUseCase';

function buildRequester(overrides: Record<string, any> = {}) {
  return {
    id: 1,
    isSuperAdmin: () => false,
    ...overrides,
  };
}

function buildDeps() {
  return {
    conversationRepository: { isParticipant: jest.fn().mockResolvedValue(true) },
    attachmentStorageService: {
      readUploadMeta: jest.fn().mockResolvedValue({
        userId: 1,
        conversationId: 10,
        type: 'image',
        originalName: 'a.png',
        sizeBytes: 2048,
        chunkCount: 2,
      }),
      listReceivedChunkIndexes: jest.fn().mockResolvedValue([0, 1]),
      assembleUpload: jest.fn().mockResolvedValue('generated-key.png'),
    },
    sendMessageUseCase: { execute: jest.fn().mockResolvedValue({ id: 100 }) },
  };
}

describe('CompleteUploadUseCase', () => {
  it('rejects a SuperAdmin requester', async () => {
    const deps = buildDeps();
    const useCase = new CompleteUploadUseCase(deps);

    await expect(
      useCase.execute({ requester: buildRequester({ isSuperAdmin: () => true }), uploadId: 'u1' })
    ).rejects.toThrow('SuperAdmin cannot access messaging');
  });

  it('rejects when the upload does not exist', async () => {
    const deps = buildDeps();
    deps.attachmentStorageService.readUploadMeta.mockResolvedValue(null);
    const useCase = new CompleteUploadUseCase(deps);

    await expect(useCase.execute({ requester: buildRequester(), uploadId: 'u1' })).rejects.toThrow('Upload not found');
  });

  it('rejects a requester who did not start the upload', async () => {
    const deps = buildDeps();
    const useCase = new CompleteUploadUseCase(deps);

    await expect(useCase.execute({ requester: buildRequester({ id: 2 }), uploadId: 'u1' })).rejects.toThrow(
      'did not start this upload'
    );
  });

  it('rejects a requester who is no longer a participant', async () => {
    const deps = buildDeps();
    deps.conversationRepository.isParticipant.mockResolvedValue(false);
    const useCase = new CompleteUploadUseCase(deps);

    await expect(useCase.execute({ requester: buildRequester(), uploadId: 'u1' })).rejects.toThrow('not a participant');
  });

  it('rejects completion before every chunk has been received', async () => {
    const deps = buildDeps();
    deps.attachmentStorageService.listReceivedChunkIndexes.mockResolvedValue([0]);
    const useCase = new CompleteUploadUseCase(deps);

    await expect(useCase.execute({ requester: buildRequester(), uploadId: 'u1' })).rejects.toThrow(
      'Not all chunks have been received yet'
    );
    expect(deps.attachmentStorageService.assembleUpload).not.toHaveBeenCalled();
  });

  it('assembles the file and delegates message creation to sendMessageUseCase', async () => {
    const deps = buildDeps();
    const useCase = new CompleteUploadUseCase(deps);

    const result = await useCase.execute({ requester: buildRequester(), uploadId: 'u1', replyToMessageId: 5 });

    expect(deps.attachmentStorageService.assembleUpload).toHaveBeenCalledWith('u1', 10, 'a.png');
    expect(deps.sendMessageUseCase.execute).toHaveBeenCalledWith({
      requester: expect.objectContaining({ id: 1 }),
      conversationId: 10,
      type: 'image',
      replyToMessageId: 5,
      attachment: { key: 'generated-key.png', originalName: 'a.png', sizeBytes: 2048 },
    });
    expect(result).toEqual({ id: 100 });
  });
});
