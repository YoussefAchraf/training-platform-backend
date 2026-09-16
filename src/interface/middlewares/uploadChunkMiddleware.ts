import express from 'express';

export default function uploadChunkMiddlewareFactory({ attachmentStorageService }) {
  const limit = attachmentStorageService.chunkSizeBytes + 64 * 1024;
  const rawParser = express.raw({ type: '*/*', limit });

  return function uploadChunkMiddleware(req, res, next) {
    rawParser(req, res, (err) => {
      if (err) return res.status(400).json({ error: 'Chunk too large' });
      next();
    });
  };
}
