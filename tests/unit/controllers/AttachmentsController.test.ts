import fs from 'fs';
import os from 'os';
import path from 'path';
import { once } from 'events';
import { Writable } from 'stream';
import { AttachmentsController } from '../../../src/interface/controllers/AttachmentsController';

class FakeResponse extends Writable {
  headers: Record<string, string> = {};
  statusCode = 200;
  jsonBody: any = undefined;
  chunks: Buffer[] = [];
  headersSent = false;

  setHeader(name: string, value: string) {
    this.headers[name.toLowerCase()] = String(value);
  }

  status(code: number) {
    this.statusCode = code;
    return this;
  }

  json(body: any) {
    this.jsonBody = body;
    this.headersSent = true;
    this.end();
    return this;
  }

  _write(chunk: any, _encoding: string, callback: () => void) {
    this.headersSent = true;
    this.chunks.push(Buffer.from(chunk));
    callback();
  }

  get body() {
    return Buffer.concat(this.chunks);
  }
}

function buildController(overrides: { message?: any; execute?: jest.Mock; filePath: string }) {
  const message = overrides.message ?? {
    id: 5,
    conversationId: 3,
    type: 'image',
    attachmentKey: 'abc.png',
    attachmentMime: 'image/png',
    attachmentOriginalName: 'photo.png',
  };
  const downloadAttachmentUseCase = { execute: overrides.execute ?? jest.fn().mockResolvedValue(message) };
  const attachmentStorageService = { resolvePath: jest.fn().mockReturnValue(overrides.filePath) };
  return {
    controller: new AttachmentsController({ downloadAttachmentUseCase, attachmentStorageService }),
    downloadAttachmentUseCase,
    attachmentStorageService,
  };
}

const req = { user: { id: 1 }, params: { messageId: '5' } };

describe('AttachmentsController.download', () => {
  let dir: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'attachments-controller-'));
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('streams the stored file with its type, inline disposition and exact length', async () => {
    const filePath = path.join(dir, 'abc.png');
    const bytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 1, 2, 3, 4, 5]);
    fs.writeFileSync(filePath, bytes);
    const { controller } = buildController({ filePath });
    const res = new FakeResponse();

    await controller.download(req, res);
    await once(res, 'finish');

    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toBe('image/png');
    expect(res.headers['content-disposition']).toBe('inline; filename="photo.png"');
    expect(res.headers['content-length']).toBe(String(bytes.length));
    expect(res.body.equals(bytes)).toBe(true);
  });

  it('serves a non-media attachment as a download', async () => {
    const filePath = path.join(dir, 'report.pdf');
    fs.writeFileSync(filePath, 'pdf-bytes');
    const message = { id: 6, conversationId: 3, type: 'file', attachmentKey: 'r.pdf', attachmentMime: 'application/pdf', attachmentOriginalName: 'report.pdf' };
    const { controller } = buildController({ filePath, message });
    const res = new FakeResponse();

    await controller.download(req, res);
    await once(res, 'finish');

    expect(res.headers['content-disposition']).toBe('attachment; filename="report.pdf"');
  });

  it('answers 404 instead of crashing the process when the stored file is missing', async () => {
    const { controller } = buildController({ filePath: path.join(dir, 'gone.png') });
    const res = new FakeResponse();
    const uncaught = jest.fn();
    process.on('uncaughtException', uncaught);

    await controller.download(req, res);
    await new Promise((resolve) => setImmediate(resolve));
    process.off('uncaughtException', uncaught);

    expect(res.statusCode).toBe(404);
    expect(res.jsonBody).toEqual({ error: 'Attachment file not found' });
    expect(uncaught).not.toHaveBeenCalled();
  });

  it('keeps answering 400 with the reason when the use case rejects the request', async () => {
    const execute = jest.fn().mockRejectedValue(new Error('You are not a participant of this conversation'));
    const { controller } = buildController({ filePath: path.join(dir, 'x'), execute });
    const res = new FakeResponse();

    await controller.download(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.jsonBody).toEqual({ error: 'You are not a participant of this conversation' });
  });

  it('answers 400 when the stored key resolves outside the storage root', async () => {
    const { controller, attachmentStorageService } = buildController({ filePath: path.join(dir, 'x') });
    attachmentStorageService.resolvePath.mockImplementation(() => {
      throw new Error('Invalid attachment key');
    });
    const res = new FakeResponse();

    await controller.download(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.jsonBody).toEqual({ error: 'Invalid attachment key' });
  });

  it('answers 404 when the path exists but is not a readable file location (ENOTDIR)', async () => {
    const fileAsDir = path.join(dir, 'plain.txt');
    fs.writeFileSync(fileAsDir, 'x');
    const { controller } = buildController({ filePath: path.join(fileAsDir, 'child.png') });
    const res = new FakeResponse();

    await controller.download(req, res);

    expect(res.statusCode).toBe(404);
  });
});
