class CompleteUploadUseCase {
  conversationRepository: any;
  attachmentStorageService: any;
  sendMessageUseCase: any;

  constructor({ conversationRepository, attachmentStorageService, sendMessageUseCase }) {
    this.conversationRepository = conversationRepository;
    this.attachmentStorageService = attachmentStorageService;
    this.sendMessageUseCase = sendMessageUseCase;
  }

  async execute({ requester, uploadId, replyToMessageId }: { requester: any; uploadId: string; replyToMessageId?: any }) {
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

    const receivedIndexes = await this.attachmentStorageService.listReceivedChunkIndexes(uploadId);
    if (receivedIndexes.length !== meta.chunkCount) {
      throw new Error('Not all chunks have been received yet');
    }

    const key = await this.attachmentStorageService.assembleUpload(uploadId, meta.conversationId, meta.originalName);

    return this.sendMessageUseCase.execute({
      requester,
      conversationId: meta.conversationId,
      type: meta.type,
      replyToMessageId,
      attachment: { key, originalName: meta.originalName, sizeBytes: meta.sizeBytes },
    });
  }
}

export { CompleteUploadUseCase };
