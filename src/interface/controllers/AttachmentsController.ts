import fs from 'fs';

function sanitizeFilenameForHeader(name) {
  return String(name || 'file').replace(/[\r\n"]/g, '');
}

class AttachmentsController {
  downloadAttachmentUseCase: any;
  attachmentStorageService: any;

  constructor({ downloadAttachmentUseCase, attachmentStorageService }) {
    this.downloadAttachmentUseCase = downloadAttachmentUseCase;
    this.attachmentStorageService = attachmentStorageService;
  }

  download = async (req, res) => {
    try {
      const message = await this.downloadAttachmentUseCase.execute({
        requester: req.user,
        messageId: Number(req.params.messageId),
      });
      const filePath = this.attachmentStorageService.resolvePath(message.conversationId, message.attachmentKey);
      const disposition = message.type === 'image' || message.type === 'voice' ? 'inline' : 'attachment';

      res.setHeader('Content-Type', message.attachmentMime || 'application/octet-stream');
      const filename = sanitizeFilenameForHeader(message.attachmentOriginalName || message.attachmentKey);
      res.setHeader('Content-Disposition', `${disposition}; filename="${filename}"`);
      fs.createReadStream(filePath).pipe(res);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  };
}

export { AttachmentsController };
