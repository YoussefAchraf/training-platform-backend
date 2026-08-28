import multer from 'multer';

const ALLOWED_EXTENSIONS = ['.csv', '.xlsx'];

function fileFilter(req, file, cb) {
  const name = (file.originalname || '').toLowerCase();
  const isAllowed = ALLOWED_EXTENSIONS.some((ext) => name.endsWith(ext));
  if (!isAllowed) {
    cb(new Error('Unsupported file type - please upload a .xlsx or .csv file'));
    return;
  }
  cb(null, true);
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter,
});

export default function uploadAttendeesFile(req, res, next) {
  upload.single('file')(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    next();
  });
};
