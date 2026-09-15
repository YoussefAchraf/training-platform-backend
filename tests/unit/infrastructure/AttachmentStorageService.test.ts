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
});
