import cron from 'node-cron';

class AttachmentUploadGcService {
  attachmentStorageService: any;

  constructor({ attachmentStorageService }) {
    this.attachmentStorageService = attachmentStorageService;
  }

  start() {
    const cronExpression = process.env.ATTACHMENT_UPLOAD_GC_CRON || '0 * * * *';
    const maxAgeMs = Number(process.env.ATTACHMENT_UPLOAD_GC_MAX_AGE_HOURS || 24) * 60 * 60 * 1000;

    cron.schedule(cronExpression, async () => {
      try {
        const staleIds = await this.attachmentStorageService.listStaleUploadIds(maxAgeMs);
        for (const uploadId of staleIds) {
          await this.attachmentStorageService.abortUpload(uploadId);
        }
        if (staleIds.length > 0) {
          console.log(`[AttachmentUploadGc] Removed ${staleIds.length} abandoned upload(s)`);
        }
      } catch (err) {
        console.error('[AttachmentUploadGc] Failed to sweep abandoned uploads:', err.message);
      }
    });

    console.log(`[AttachmentUploadGc] Started (cron: "${cronExpression}")`);
  }
}

export { AttachmentUploadGcService };
