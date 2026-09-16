import { UploadChunkUseCase } from '../../../src/use-cases/messaging/UploadChunkUseCase';

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
      readUploadMeta: jest.fn().mockResolvedValue({ userId: 1, conversationId: 10, chunkCount: 3, chunkSize: 1024 }),
      writeChunk: jest.fn().mockResolvedValue(undefined),
      listReceivedChunkIndexes: jest.fn().mockResolvedValue([0]),
    },
  };
}

describe('UploadChunkUseCase', () => {
  it('rejects a SuperAdmin requester', async () => {
    const deps = buildDeps();
    const useCase = new UploadChunkUseCase(deps);

    await expect(
      useCase.execute({ requester: buildRequester({ isSuperAdmin: () => true }), uploadId: 'u1', index: 0, buffer: Buffer.from('x') })
    ).rejects.toThrow('SuperAdmin cannot access messaging');
  });

  it('rejects when the upload does not exist', async () => {
    const deps = buildDeps();
    deps.attachmentStorageService.readUploadMeta.mockResolvedValue(null);
    const useCase = new UploadChunkUseCase(deps);

    await expect(
      useCase.execute({ requester: buildRequester(), uploadId: 'u1', index: 0, buffer: Buffer.from('x') })
    ).rejects.toThrow('Upload not found');
  });

  it('rejects a requester who did not start the upload', async () => {
    const deps = buildDeps();
    const useCase = new UploadChunkUseCase(deps);

    await expect(
      useCase.execute({ requester: buildRequester({ id: 2 }), uploadId: 'u1', index: 0, buffer: Buffer.from('x') })
    ).rejects.toThrow('did not start this upload');
  });

  it('rejects a requester who is no longer a participant', async () => {
    const deps = buildDeps();
    deps.conversationRepository.isParticipant.mockResolvedValue(false);
    const useCase = new UploadChunkUseCase(deps);

    await expect(
      useCase.execute({ requester: buildRequester(), uploadId: 'u1', index: 0, buffer: Buffer.from('x') })
    ).rejects.toThrow('not a participant');
  });

  it('rejects an out-of-range chunk index', async () => {
    const deps = buildDeps();
    const useCase = new UploadChunkUseCase(deps);

    await expect(
      useCase.execute({ requester: buildRequester(), uploadId: 'u1', index: 5, buffer: Buffer.from('x') })
    ).rejects.toThrow('Invalid chunk index');
    await expect(
      useCase.execute({ requester: buildRequester(), uploadId: 'u1', index: -1, buffer: Buffer.from('x') })
    ).rejects.toThrow('Invalid chunk index');
  });

  it('rejects an empty chunk', async () => {
    const deps = buildDeps();
    const useCase = new UploadChunkUseCase(deps);

    await expect(
      useCase.execute({ requester: buildRequester(), uploadId: 'u1', index: 0, buffer: Buffer.alloc(0) })
    ).rejects.toThrow('Empty chunk');
  });

  it('rejects a chunk larger than the configured chunk size', async () => {
    const deps = buildDeps();
    const useCase = new UploadChunkUseCase(deps);

    await expect(
      useCase.execute({ requester: buildRequester(), uploadId: 'u1', index: 0, buffer: Buffer.alloc(2000) })
    ).rejects.toThrow('exceeds the configured chunk size');
  });

  it('writes a valid chunk and returns the current progress', async () => {
    const deps = buildDeps();
    const useCase = new UploadChunkUseCase(deps);

    const result = await useCase.execute({ requester: buildRequester(), uploadId: 'u1', index: 1, buffer: Buffer.from('data') });

    expect(deps.attachmentStorageService.writeChunk).toHaveBeenCalledWith('u1', 1, Buffer.from('data'));
    expect(result).toEqual({ receivedIndexes: [0], chunkCount: 3 });
  });
});
