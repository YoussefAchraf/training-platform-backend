import fs from 'fs';
import os from 'os';
import path from 'path';
import { AttachmentStorageService } from '../../../src/infrastructure/services/AttachmentStorageService';

let tmpDir: string;

describe('AttachmentStorageService', () => {
  beforeAll(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'attachment-storage-test-'));
    process.env.ATTACHMENT_STORAGE_DIR = tmpDir;
    process.env.ATTACHMENT_MAX_IMAGE_MB = '1';
  });

  afterAll(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    delete process.env.ATTACHMENT_STORAGE_DIR;
    delete process.env.ATTACHMENT_MAX_IMAGE_MB;
  });

  it('generates a random filename that preserves a safe extension', () => {
    const service = new AttachmentStorageService();
    const name = service.generateFilename('photo.PNG');
    expect(name).toMatch(/^[0-9a-f-]{36}\.png$/);
  });

  it('drops an unsafe or missing extension rather than guessing', () => {
    const service = new AttachmentStorageService();
    expect(service.generateFilename('no-extension')).toMatch(/^[0-9a-f-]{36}$/);
    expect(service.generateFilename('../../etc/passwd')).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('creates a per-conversation directory on demand', (done) => {
    const service = new AttachmentStorageService();
    service.ensureConversationDir(42, (err, dir) => {
      expect(err).toBeNull();
      expect(fs.existsSync(dir)).toBe(true);
      expect(dir).toBe(path.join(tmpDir, '42'));
      done();
    });
  });

  it('detects a real PNG by its magic bytes, ignoring the extension', async () => {
    const service = new AttachmentStorageService();
    const key = 'real-image.bin';
    const filePath = service.resolvePath(1, key);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    const tinyPng = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
      'base64'
    );
    fs.writeFileSync(filePath, tinyPng);

    const result = await service.validateUploadedFile(1, key, 'image');
    expect(result.mime).toBe('image/png');
  });

  it('rejects a file whose real content does not match the declared type', async () => {
    const service = new AttachmentStorageService();
    const key = 'fake-image.png';
    const filePath = service.resolvePath(2, key);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, 'this is plain text pretending to be a png');

    await expect(service.validateUploadedFile(2, key, 'image')).rejects.toThrow('does not look like a valid image');
  });

  it('accepts a generic file type even when the content has no known magic bytes (e.g. plain text)', async () => {
    const service = new AttachmentStorageService();
    const key = 'notes.txt';
    const filePath = service.resolvePath(3, key);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, 'just plain text, no signature');

    await expect(service.validateUploadedFile(3, key, 'file')).resolves.toEqual(
      expect.objectContaining({ mime: null })
    );
  });

  it('accepts a real browser-recorded audio/webm voice note even though it is only detectable as video/webm', async () => {
    const service = new AttachmentStorageService();
    const key = 'voice-note.webm';
    const filePath = service.resolvePath(5, key);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    const webmHeader = Buffer.from(
      'GkXfo59ChoEBQveBAULygQRC84EIQoKEd2VibUKHgQRChYECGFOAZwEAAAAAAH1+EU2bdLlNu4tTq4QVSalmUw==',
      'base64'
    );
    fs.writeFileSync(filePath, webmHeader);

    const result = await service.validateUploadedFile(5, key, 'voice');
    expect(result.mime).toBe('audio/webm');
  });

  it('rejects a voice message whose content is not audio at all', async () => {
    const service = new AttachmentStorageService();
    const key = 'not-audio.png';
    const filePath = service.resolvePath(6, key);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    const tinyPng = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
      'base64'
    );
    fs.writeFileSync(filePath, tinyPng);

    await expect(service.validateUploadedFile(6, key, 'voice')).rejects.toThrow('does not look like a valid voice');
  });

  it('rejects a file larger than the configured limit for its type', async () => {
    const service = new AttachmentStorageService();
    const key = 'too-big.png';
    const filePath = service.resolvePath(4, key);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, Buffer.alloc(2 * 1024 * 1024));

    await expect(service.validateUploadedFile(4, key, 'image')).rejects.toThrow('exceeds the maximum allowed size');
  });

  it('deletes a stored file without throwing if it is already gone', async () => {
    const service = new AttachmentStorageService();
    await expect(service.delete(999, 'never-existed.png')).resolves.toBeUndefined();
  });

  describe('path-traversal hardening', () => {
    it('rejects a non-numeric conversation id instead of using it as a path segment', () => {
      const service = new AttachmentStorageService();
      expect(() => service.conversationDir('../../etc')).toThrow('Invalid conversation id');
      expect(() => service.resolvePath('../../etc', 'a.png')).toThrow('Invalid conversation id');
    });

    it('surfaces an invalid conversation id as a callback error, not a thrown exception, from ensureConversationDir', (done) => {
      const service = new AttachmentStorageService();
      service.ensureConversationDir('../../etc', (err, dir) => {
        expect(err).toBeInstanceOf(Error);
        expect(err.message).toBe('Invalid conversation id');
        expect(dir).toBeUndefined();
        done();
      });
    });

    it('rejects an attachment key containing path separators or traversal sequences', () => {
      const service = new AttachmentStorageService();
      expect(() => service.resolvePath(1, '../../etc/passwd')).toThrow('Invalid attachment key');
      expect(() => service.resolvePath(1, 'sub/dir/file.png')).toThrow('Invalid attachment key');
      expect(() => service.resolvePath(1, '..')).toThrow('Invalid attachment key');
    });

    it('never resolves outside the configured storage root for any input', () => {
      const service = new AttachmentStorageService();
      expect(() => service.resolvePath(1, '..\\..\\windows\\system32')).toThrow('Invalid attachment key');
    });
  });

  describe('chunked uploads', () => {
    let uploadsTmpDir: string;

    beforeAll(() => {
      uploadsTmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'attachment-uploads-test-'));
      process.env.ATTACHMENT_UPLOADS_DIR = uploadsTmpDir;
    });

    afterAll(() => {
      fs.rmSync(uploadsTmpDir, { recursive: true, force: true });
      delete process.env.ATTACHMENT_UPLOADS_DIR;
    });

    it('rejects an upload id that is not a valid uuid, instead of using it as a path segment', () => {
      const service = new AttachmentStorageService();
      expect(() => service.uploadDir('../../etc')).toThrow('Invalid upload id');
      expect(() => service.uploadDir('not-a-uuid')).toThrow('Invalid upload id');
    });

    it('rejects an out-of-range chunk index', () => {
      const service = new AttachmentStorageService();
      const uploadId = '11111111-1111-1111-1111-111111111111';
      expect(() => service.chunkPath(uploadId, -1)).toThrow('Invalid chunk index');
      expect(() => service.chunkPath(uploadId, 'a')).toThrow('Invalid chunk index');
    });

    it('round-trips upload metadata as JSON', async () => {
      const service = new AttachmentStorageService();
      const uploadId = '22222222-2222-2222-2222-222222222222';
      await service.ensureUploadDir(uploadId);
      await service.writeUploadMeta(uploadId, { conversationId: 1, userId: 2, chunkCount: 3 });

      const meta = await service.readUploadMeta(uploadId);
      expect(meta).toEqual({ conversationId: 1, userId: 2, chunkCount: 3 });
    });

    it('returns null metadata for an upload that does not exist', async () => {
      const service = new AttachmentStorageService();
      const meta = await service.readUploadMeta('33333333-3333-3333-3333-333333333333');
      expect(meta).toBeNull();
    });

    it('lists received chunk indexes in ascending order', async () => {
      const service = new AttachmentStorageService();
      const uploadId = '44444444-4444-4444-4444-444444444444';
      await service.ensureUploadDir(uploadId);
      await service.writeChunk(uploadId, 2, Buffer.from('c'));
      await service.writeChunk(uploadId, 0, Buffer.from('a'));
      await service.writeChunk(uploadId, 1, Buffer.from('b'));

      const indexes = await service.listReceivedChunkIndexes(uploadId);
      expect(indexes).toEqual([0, 1, 2]);
    });

    it('assembles received chunks in order into a single file under the conversation directory', async () => {
      const service = new AttachmentStorageService();
      const uploadId = '55555555-5555-5555-5555-555555555555';
      await service.ensureUploadDir(uploadId);
      await service.writeUploadMeta(uploadId, { chunkCount: 3 });
      await service.writeChunk(uploadId, 0, Buffer.from('Hello, '));
      await service.writeChunk(uploadId, 1, Buffer.from('chunked '));
      await service.writeChunk(uploadId, 2, Buffer.from('world!'));

      const key = await service.assembleUpload(uploadId, 7, 'greeting.txt');
      const assembledPath = service.resolvePath(7, key);
      expect(fs.readFileSync(assembledPath, 'utf8')).toBe('Hello, chunked world!');
      expect(fs.existsSync(service.uploadDir(uploadId))).toBe(false);
    });

    it('aborts an upload by removing its temp directory', async () => {
      const service = new AttachmentStorageService();
      const uploadId = '66666666-6666-6666-6666-666666666666';
      await service.ensureUploadDir(uploadId);
      await service.writeChunk(uploadId, 0, Buffer.from('x'));

      await service.abortUpload(uploadId);
      expect(fs.existsSync(service.uploadDir(uploadId))).toBe(false);
    });

    it('never throws when aborting an upload that does not exist', async () => {
      const service = new AttachmentStorageService();
      await expect(service.abortUpload('77777777-7777-7777-7777-777777777777')).resolves.toBeUndefined();
    });

    it('identifies stale uploads older than the given max age', async () => {
      const service = new AttachmentStorageService();
      const freshId = '88888888-8888-8888-8888-888888888888';
      const staleId = '99999999-9999-9999-9999-999999999999';
      await service.ensureUploadDir(freshId);
      await service.writeUploadMeta(freshId, { createdAt: new Date().toISOString() });
      await service.ensureUploadDir(staleId);
      await service.writeUploadMeta(staleId, { createdAt: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString() });

      const stale = await service.listStaleUploadIds(24 * 60 * 60 * 1000);
      expect(stale).toContain(staleId);
      expect(stale).not.toContain(freshId);
    });
  });
});
