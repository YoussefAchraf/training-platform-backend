import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

const ALLOWED_MIME_PREFIXES_BY_TYPE = {
  image: ['image/'],
  voice: ['audio/', 'video/webm', 'video/ogg'],
};

function isDetectedMimeAllowed(declaredType, detectedMime) {
  const allowedPrefixes = ALLOWED_MIME_PREFIXES_BY_TYPE[declaredType];
  if (!allowedPrefixes) return true;
  if (!detectedMime) return false;
  return allowedPrefixes.some((prefix) => detectedMime.startsWith(prefix));
}

function sanitizeExtension(originalName) {
  const ext = path.extname(originalName || '').toLowerCase();
  return /^\.[a-z0-9]{1,10}$/.test(ext) ? ext : '';
}

function toSafeConversationId(conversationId) {
  const id = Number(conversationId);
  if (!Number.isInteger(id) || id <= 0) {
    throw new Error('Invalid conversation id');
  }
  return String(id);
}

function assertSafeAttachmentKey(key) {
  if (typeof key !== 'string' || key.includes('..') || !/^[A-Za-z0-9._-]{1,255}$/.test(key)) {
    throw new Error('Invalid attachment key');
  }
}

function resolveWithinRoot(root, ...segments) {
  const resolvedRoot = path.resolve(root);
  const resolvedPath = path.resolve(resolvedRoot, ...segments);
  if (resolvedPath !== resolvedRoot && !resolvedPath.startsWith(resolvedRoot + path.sep)) {
    throw new Error('Resolved path escapes the attachment storage root');
  }
  return resolvedPath;
}

const UPLOAD_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function assertSafeUploadId(uploadId) {
  if (typeof uploadId !== 'string' || !UPLOAD_ID_PATTERN.test(uploadId)) {
    throw new Error('Invalid upload id');
  }
}

function assertSafeChunkIndex(index) {
  const parsed = Number(index);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 100000) {
    throw new Error('Invalid chunk index');
  }
  return parsed;
}

class AttachmentStorageService {
  root: string;
  tempUploadsRoot: string;
  sizeLimitsBytes: Record<string, number>;
  chunkSizeBytes: number;

  constructor() {
    this.root = process.env.ATTACHMENT_STORAGE_DIR || path.join(process.cwd(), 'storage', 'attachments');
    this.tempUploadsRoot =
      process.env.ATTACHMENT_UPLOADS_DIR || path.join(process.cwd(), 'storage', 'attachment-uploads');
    this.sizeLimitsBytes = {
      image: Number(process.env.ATTACHMENT_MAX_IMAGE_MB || 10) * 1024 * 1024,
      voice: Number(process.env.ATTACHMENT_MAX_VOICE_MB || 15) * 1024 * 1024,
      file: Number(process.env.ATTACHMENT_MAX_FILE_MB || 25) * 1024 * 1024,
    };
    this.chunkSizeBytes = Number(process.env.ATTACHMENT_CHUNK_SIZE_BYTES || 1024 * 1024);
  }

  conversationDir(conversationId) {
    return resolveWithinRoot(this.root, toSafeConversationId(conversationId));
  }

  maxUploadSizeBytes() {
    return Math.max(...Object.values(this.sizeLimitsBytes));
  }

  limitFor(type) {
    return this.sizeLimitsBytes[type] || this.sizeLimitsBytes.file;
  }

  ensureConversationDir(conversationId, callback) {
    let dir;
    try {
      dir = this.conversationDir(conversationId);
    } catch (err) {
      callback(err, undefined);
      return;
    }
    fs.mkdir(dir, { recursive: true }, (err) => callback(err, dir));
  }

  generateFilename(originalName) {
    return `${crypto.randomUUID()}${sanitizeExtension(originalName)}`;
  }

  resolvePath(conversationId, key) {
    assertSafeAttachmentKey(key);
    return resolveWithinRoot(this.conversationDir(conversationId), key);
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
    if (!isDetectedMimeAllowed(declaredType, detectedMime)) {
      throw new Error(`The uploaded file does not look like a valid ${declaredType}`);
    }

    const normalizedMime =
      declaredType === 'voice' && detectedMime?.startsWith('video/') ? detectedMime.replace('video/', 'audio/') : detectedMime;

    return { mime: normalizedMime, sizeBytes: stats.size };
  }

  async delete(conversationId, key) {
    await fs.promises.unlink(this.resolvePath(conversationId, key)).catch(() => {});
  }

  uploadDir(uploadId) {
    assertSafeUploadId(uploadId);
    return resolveWithinRoot(this.tempUploadsRoot, uploadId);
  }

  async ensureUploadDir(uploadId) {
    const dir = this.uploadDir(uploadId);
    await fs.promises.mkdir(dir, { recursive: true });
    return dir;
  }

  metaPath(uploadId) {
    return resolveWithinRoot(this.uploadDir(uploadId), 'meta.json');
  }

  async writeUploadMeta(uploadId, meta) {
    await fs.promises.writeFile(this.metaPath(uploadId), JSON.stringify(meta), 'utf8');
  }

  async readUploadMeta(uploadId) {
    try {
      const raw = await fs.promises.readFile(this.metaPath(uploadId), 'utf8');
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  chunkPath(uploadId, index) {
    const safeIndex = assertSafeChunkIndex(index);
    return resolveWithinRoot(this.uploadDir(uploadId), `${safeIndex}.part`);
  }

  async writeChunk(uploadId, index, buffer) {
    await fs.promises.writeFile(this.chunkPath(uploadId, index), buffer);
  }

  async listReceivedChunkIndexes(uploadId) {
    let entries;
    try {
      entries = await fs.promises.readdir(this.uploadDir(uploadId));
    } catch {
      return [];
    }
    return entries
      .filter((name) => name.endsWith('.part'))
      .map((name) => Number(name.slice(0, -'.part'.length)))
      .filter((index) => Number.isInteger(index))
      .sort((a, b) => a - b);
  }

  async assembleUpload(uploadId, conversationId, originalName) {
    const meta = await this.readUploadMeta(uploadId);
    if (!meta) {
      throw new Error('Upload not found');
    }

    const destDir = await new Promise<string>((resolve, reject) => {
      this.ensureConversationDir(conversationId, (err, dir) => (err ? reject(err) : resolve(dir)));
    });
    const key = this.generateFilename(originalName);
    const destPath = resolveWithinRoot(destDir, key);

    const writeStream = fs.createWriteStream(destPath);
    for (let index = 0; index < meta.chunkCount; index += 1) {
      await new Promise((resolve, reject) => {
        const readStream = fs.createReadStream(this.chunkPath(uploadId, index));
        readStream.on('error', reject);
        readStream.on('end', resolve);
        readStream.pipe(writeStream, { end: false });
      });
    }
    await new Promise((resolve, reject) => {
      writeStream.end((err) => (err ? reject(err) : resolve(undefined)));
    });

    await fs.promises.rm(this.uploadDir(uploadId), { recursive: true, force: true });
    return key;
  }

  async abortUpload(uploadId) {
    await fs.promises.rm(this.uploadDir(uploadId), { recursive: true, force: true }).catch(() => {});
  }

  async listStaleUploadIds(maxAgeMs) {
    let entries;
    try {
      entries = await fs.promises.readdir(this.tempUploadsRoot);
    } catch {
      return [];
    }

    const stale: string[] = [];
    for (const entry of entries) {
      if (!UPLOAD_ID_PATTERN.test(entry)) continue;
      const meta = await this.readUploadMeta(entry);
      const createdAt = meta?.createdAt ? new Date(meta.createdAt).getTime() : 0;
      if (!createdAt || Date.now() - createdAt > maxAgeMs) {
        stale.push(entry);
      }
    }
    return stale;
  }
}

export { AttachmentStorageService };
