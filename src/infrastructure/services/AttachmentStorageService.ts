import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

const MIME_PREFIX_BY_TYPE = { image: 'image/', voice: 'audio/' };

function sanitizeExtension(originalName) {
  const ext = path.extname(originalName || '').toLowerCase();
  return /^\.[a-z0-9]{1,10}$/.test(ext) ? ext : '';
}

class AttachmentStorageService {
  root: string;
  sizeLimitsBytes: Record<string, number>;

  constructor() {
    this.root = process.env.ATTACHMENT_STORAGE_DIR || path.join(process.cwd(), 'storage', 'attachments');
    this.sizeLimitsBytes = {
      image: Number(process.env.ATTACHMENT_MAX_IMAGE_MB || 10) * 1024 * 1024,
      voice: Number(process.env.ATTACHMENT_MAX_VOICE_MB || 15) * 1024 * 1024,
      file: Number(process.env.ATTACHMENT_MAX_FILE_MB || 25) * 1024 * 1024,
    };
  }

  conversationDir(conversationId) {
    return path.join(this.root, String(conversationId));
  }

  maxUploadSizeBytes() {
    return Math.max(...Object.values(this.sizeLimitsBytes));
  }

  limitFor(type) {
    return this.sizeLimitsBytes[type] || this.sizeLimitsBytes.file;
  }

  ensureConversationDir(conversationId, callback) {
    const dir = this.conversationDir(conversationId);
    fs.mkdir(dir, { recursive: true }, (err) => callback(err, dir));
  }

  generateFilename(originalName) {
    return `${crypto.randomUUID()}${sanitizeExtension(originalName)}`;
  }

  resolvePath(conversationId, key) {
    return path.join(this.conversationDir(conversationId), key);
  }

  async detectMime(filePath) {
    const { fileTypeFromFile } = await import('file-type');
    const detected = await fileTypeFromFile(filePath);
    return detected?.mime || null;
  }

  async validateUploadedFile(conversationId, key, declaredType) {
    const filePath = this.resolvePath(conversationId, key);
    const stats = await fs.promises.stat(filePath);
    if (stats.size > this.limitFor(declaredType)) {
      throw new Error(`This ${declaredType} exceeds the maximum allowed size`);
    }

    const detectedMime = await this.detectMime(filePath);
    const requiredPrefix = MIME_PREFIX_BY_TYPE[declaredType];
    if (requiredPrefix && (!detectedMime || !detectedMime.startsWith(requiredPrefix))) {
      throw new Error(`The uploaded file does not look like a valid ${declaredType}`);
    }

    return { mime: detectedMime, sizeBytes: stats.size };
  }

  async delete(conversationId, key) {
    await fs.promises.unlink(this.resolvePath(conversationId, key)).catch(() => {});
  }
}

export { AttachmentStorageService };
