class AbortUploadUseCase {
  attachmentStorageService: any;

  constructor({ attachmentStorageService }) {
    this.attachmentStorageService = attachmentStorageService;
  }

  async execute({ requester, uploadId }: { requester: any; uploadId: string }) {
    if (requester.isSuperAdmin()) {
      throw new Error('SuperAdmin cannot access messaging');
    }

    const meta = await this.attachmentStorageService.readUploadMeta(uploadId);
    if (meta && Number(meta.userId) !== Number(requester.id)) {
      throw new Error('You did not start this upload');
    }

    await this.attachmentStorageService.abortUpload(uploadId);
    return { uploadId };
  }
}

export { AbortUploadUseCase };
