import multer from 'multer';

export default function uploadMessageAttachmentFactory({ attachmentStorageService }) {
  const storage = multer.diskStorage({
    destination: (req, _file, cb) => {
      attachmentStorageService.ensureConversationDir(req.params.id, cb);
    },
    filename: (_req, file, cb) => {
      cb(null, attachmentStorageService.generateFilename(file.originalname));
    },
  });

  const upload = multer({ storage, limits: { fileSize: attachmentStorageService.maxUploadSizeBytes() } });

  return function uploadMessageAttachment(req, res, next) {
    upload.single('file')(req, res, (err) => {
      if (err) return res.status(400).json({ error: err.message });
      next();
    });
  };
}
