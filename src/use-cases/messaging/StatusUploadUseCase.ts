class StatusUploadUseCase {
  attachmentStorageService: any;

  constructor({ attachmentStorageService }) {
    this.attachmentStorageService = attachmentStorageService;
  }

  async execute({ requester, uploadId }: { requester: any; uploadId: string }) {
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

    const receivedIndexes = await this.attachmentStorageService.listReceivedChunkIndexes(uploadId);
    return { receivedIndexes, chunkCount: meta.chunkCount, chunkSize: meta.chunkSize };
  }
}

export { StatusUploadUseCase };
