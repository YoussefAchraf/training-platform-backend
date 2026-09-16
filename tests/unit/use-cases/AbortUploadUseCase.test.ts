import { AbortUploadUseCase } from '../../../src/use-cases/messaging/AbortUploadUseCase';

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
      readUploadMeta: jest.fn().mockResolvedValue({ userId: 1 }),
      abortUpload: jest.fn().mockResolvedValue(undefined),
    },
  };
}

describe('AbortUploadUseCase', () => {
  it('rejects a SuperAdmin requester', async () => {
    const deps = buildDeps();
    const useCase = new AbortUploadUseCase(deps);

    await expect(
      useCase.execute({ requester: buildRequester({ isSuperAdmin: () => true }), uploadId: 'u1' })
    ).rejects.toThrow('SuperAdmin cannot access messaging');
    expect(deps.attachmentStorageService.abortUpload).not.toHaveBeenCalled();
  });

  it('rejects a requester who did not start the upload', async () => {
    const deps = buildDeps();
    const useCase = new AbortUploadUseCase(deps);

    await expect(useCase.execute({ requester: buildRequester({ id: 2 }), uploadId: 'u1' })).rejects.toThrow(
      'did not start this upload'
    );
  });

  it('aborts even if the upload no longer exists (idempotent)', async () => {
    const deps = buildDeps();
    deps.attachmentStorageService.readUploadMeta.mockResolvedValue(null);
    const useCase = new AbortUploadUseCase(deps);

    await expect(useCase.execute({ requester: buildRequester(), uploadId: 'u1' })).resolves.toEqual({ uploadId: 'u1' });
    expect(deps.attachmentStorageService.abortUpload).toHaveBeenCalledWith('u1');
  });

  it('aborts the upload for its owner', async () => {
    const deps = buildDeps();
    const useCase = new AbortUploadUseCase(deps);

    const result = await useCase.execute({ requester: buildRequester(), uploadId: 'u1' });

    expect(deps.attachmentStorageService.abortUpload).toHaveBeenCalledWith('u1');
    expect(result).toEqual({ uploadId: 'u1' });
  });
});
