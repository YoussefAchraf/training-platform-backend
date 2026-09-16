import { InitiateUploadUseCase } from '../../../src/use-cases/messaging/InitiateUploadUseCase';

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
    conversationRepository: { isParticipant: jest.fn().mockResolvedValue(true) },
    attachmentStorageService: {
      limitFor: jest.fn().mockReturnValue(10 * 1024 * 1024),
      chunkSizeBytes: 1024 * 1024,
      ensureUploadDir: jest.fn().mockResolvedValue(undefined),
      writeUploadMeta: jest.fn().mockResolvedValue(undefined),
    },
  };
}

describe('InitiateUploadUseCase', () => {
  it('rejects a SuperAdmin requester', async () => {
    const deps = buildDeps();
    const useCase = new InitiateUploadUseCase(deps);

    await expect(
      useCase.execute({
        requester: buildRequester({ isSuperAdmin: () => true }),
        conversationId: 10,
        type: 'image',
        originalName: 'a.png',
        sizeBytes: 1000,
      })
    ).rejects.toThrow('SuperAdmin cannot access messaging');
  });

  it('rejects a requester outside the messaging allow-list', async () => {
    const deps = buildDeps();
    const useCase = new InitiateUploadUseCase(deps);

    await expect(
      useCase.execute({
        requester: buildRequester({ roleName: 'Sales' }),
        conversationId: 10,
        type: 'image',
        originalName: 'a.png',
        sizeBytes: 1000,
      })
    ).rejects.toThrow('Only Manager and Instructor');
  });

  it('rejects an invalid attachment type', async () => {
    const deps = buildDeps();
    const useCase = new InitiateUploadUseCase(deps);

    await expect(
      useCase.execute({ requester: buildRequester(), conversationId: 10, type: 'video', originalName: 'a.mp4', sizeBytes: 1000 })
    ).rejects.toThrow('Invalid attachment type');
  });

  it('rejects a non-participant', async () => {
    const deps = buildDeps();
    deps.conversationRepository.isParticipant.mockResolvedValue(false);
    const useCase = new InitiateUploadUseCase(deps);

    await expect(
      useCase.execute({ requester: buildRequester(), conversationId: 10, type: 'image', originalName: 'a.png', sizeBytes: 1000 })
    ).rejects.toThrow('not a participant');
  });

  it('rejects a file larger than the configured limit for its type', async () => {
    const deps = buildDeps();
    const useCase = new InitiateUploadUseCase(deps);

    await expect(
      useCase.execute({
        requester: buildRequester(),
        conversationId: 10,
        type: 'image',
        originalName: 'a.png',
        sizeBytes: 20 * 1024 * 1024,
      })
    ).rejects.toThrow('exceeds the maximum allowed size');
  });

  it('rejects an invalid size', async () => {
    const deps = buildDeps();
    const useCase = new InitiateUploadUseCase(deps);

    await expect(
      useCase.execute({ requester: buildRequester(), conversationId: 10, type: 'image', originalName: 'a.png', sizeBytes: -5 })
    ).rejects.toThrow('Invalid file size');
  });

  it('creates an upload session and returns chunking info', async () => {
    const deps = buildDeps();
    const useCase = new InitiateUploadUseCase(deps);

    const result = await useCase.execute({
      requester: buildRequester(),
      conversationId: 10,
      type: 'image',
      originalName: 'a.png',
      sizeBytes: 2.5 * 1024 * 1024,
    });

    expect(result.chunkSize).toBe(1024 * 1024);
    expect(result.chunkCount).toBe(3);
    expect(typeof result.uploadId).toBe('string');
    expect(deps.attachmentStorageService.ensureUploadDir).toHaveBeenCalledWith(result.uploadId);
    expect(deps.attachmentStorageService.writeUploadMeta).toHaveBeenCalledWith(
      result.uploadId,
      expect.objectContaining({ conversationId: 10, userId: 1, type: 'image', originalName: 'a.png' })
    );
  });
});
