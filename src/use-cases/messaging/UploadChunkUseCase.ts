class UploadChunkUseCase {
  conversationRepository: any;
  attachmentStorageService: any;

  constructor({ conversationRepository, attachmentStorageService }) {
    this.conversationRepository = conversationRepository;
    this.attachmentStorageService = attachmentStorageService;
  }

  async execute({
    requester,
    uploadId,
    index,
    buffer,
  }: {
    requester: any;
    uploadId: string;
    index: any;
    buffer: Buffer;
  }) {
    if (requester.isSuperAdmin()) {
      throw new Error('SuperAdmin cannot access messaging');
    }

    const meta = await this.attachmentStorageService.readUploadMeta(uploadId);
    if (!meta) {
      throw new Error('Upload not found');
    }
    if (Number(meta.userId) !== Number(requester.id)) {
      throw new Error('You did not start this upload');
    }

    const isParticipant = await this.conversationRepository.isParticipant(meta.conversationId, requester.id);
    if (!isParticipant) {
      throw new Error('You are not a participant of this conversation');
    }

    const parsedIndex = Number(index);
    if (!Number.isInteger(parsedIndex) || parsedIndex < 0 || parsedIndex >= meta.chunkCount) {
      throw new Error('Invalid chunk index for this upload');
    }
    if (!buffer || buffer.length === 0) {
      throw new Error('Empty chunk');
    }
    if (buffer.length > meta.chunkSize) {
      throw new Error('Chunk exceeds the configured chunk size');
    }

    await this.attachmentStorageService.writeChunk(uploadId, parsedIndex, buffer);
    const receivedIndexes = await this.attachmentStorageService.listReceivedChunkIndexes(uploadId);

    return { receivedIndexes, chunkCount: meta.chunkCount };
  }
}

export { UploadChunkUseCase };
