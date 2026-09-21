import fs from 'fs';
import { pipeline } from 'stream';

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
    let message;
    let filePath;
    try {
      message = await this.downloadAttachmentUseCase.execute({
        requester: req.user,
        messageId: Number(req.params.messageId),
      });
      filePath = this.attachmentStorageService.resolvePath(message.conversationId, message.attachmentKey);
    } catch (err) {
      res.status(400).json({ error: err.message });
      return;
    }

    let stats;
    try {
      stats = await fs.promises.stat(filePath);
    } catch (err) {
      if (err.code === 'ENOENT' || err.code === 'ENOTDIR') {
        res.status(404).json({ error: 'Attachment file not found' });
        return;
      }
      console.error('[AttachmentsController] Failed to read attachment:', err.message);
      res.status(500).json({ error: 'Attachment could not be read' });
      return;
    }

    const disposition = message.type === 'image' || message.type === 'voice' ? 'inline' : 'attachment';
    const filename = sanitizeFilenameForHeader(message.attachmentOriginalName || message.attachmentKey);
    res.setHeader('Content-Type', message.attachmentMime || 'application/octet-stream');
    res.setHeader('Content-Disposition', `${disposition}; filename="${filename}"`);
    res.setHeader('Content-Length', String(stats.size));

    pipeline(fs.createReadStream(filePath), res, (err) => {
      if (!err || err.code === 'ERR_STREAM_PREMATURE_CLOSE') return;
      console.error('[AttachmentsController] Attachment stream failed:', err.message);
    });
  };
}

export { AttachmentsController };
