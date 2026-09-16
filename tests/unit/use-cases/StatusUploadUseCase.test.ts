import { StatusUploadUseCase } from '../../../src/use-cases/messaging/StatusUploadUseCase';

function buildRequester(overrides: Record<string, any> = {}) {
  return {
    id: 1,
    isSuperAdmin: () => false,
    ...overrides,
  };
}

function buildDeps() {
  return {
    attachmentStorageService: {
      readUploadMeta: jest.fn().mockResolvedValue({ userId: 1, chunkCount: 3, chunkSize: 1024 }),
      listReceivedChunkIndexes: jest.fn().mockResolvedValue([0, 2]),
    },
  };
}

describe('StatusUploadUseCase', () => {
  it('rejects a SuperAdmin requester', async () => {
    const deps = buildDeps();
    const useCase = new StatusUploadUseCase(deps);

    await expect(
      useCase.execute({ requester: buildRequester({ isSuperAdmin: () => true }), uploadId: 'u1' })
    ).rejects.toThrow('SuperAdmin cannot access messaging');
  });

  it('rejects when the upload does not exist', async () => {
    const deps = buildDeps();
    deps.attachmentStorageService.readUploadMeta.mockResolvedValue(null);
    const useCase = new StatusUploadUseCase(deps);

    await expect(useCase.execute({ requester: buildRequester(), uploadId: 'u1' })).rejects.toThrow('Upload not found');
  });

  it('rejects a requester who did not start the upload', async () => {
    const deps = buildDeps();
    const useCase = new StatusUploadUseCase(deps);

    await expect(useCase.execute({ requester: buildRequester({ id: 2 }), uploadId: 'u1' })).rejects.toThrow(
      'did not start this upload'
    );
  });

  it('returns the received chunk indexes for resuming', async () => {
    const deps = buildDeps();
    const useCase = new StatusUploadUseCase(deps);

    const result = await useCase.execute({ requester: buildRequester(), uploadId: 'u1' });

    expect(result).toEqual({ receivedIndexes: [0, 2], chunkCount: 3, chunkSize: 1024 });
  });
});
