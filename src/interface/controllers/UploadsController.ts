class UploadsController {
  initiateUploadUseCase: any;
  uploadChunkUseCase: any;
  completeUploadUseCase: any;
  abortUploadUseCase: any;
  statusUploadUseCase: any;

  constructor({ initiateUploadUseCase, uploadChunkUseCase, completeUploadUseCase, abortUploadUseCase, statusUploadUseCase }) {
    this.initiateUploadUseCase = initiateUploadUseCase;
    this.uploadChunkUseCase = uploadChunkUseCase;
    this.completeUploadUseCase = completeUploadUseCase;
    this.abortUploadUseCase = abortUploadUseCase;
    this.statusUploadUseCase = statusUploadUseCase;
  }

  initiate = async (req, res) => {
    try {
      const { type, originalName, sizeBytes } = req.body;
      const result = await this.initiateUploadUseCase.execute({
        requester: req.user,
        conversationId: Number(req.params.id),
        type,
        originalName,
        sizeBytes,
      });
      res.status(201).json(result);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  };

  chunk = async (req, res) => {
    try {
      const result = await this.uploadChunkUseCase.execute({
        requester: req.user,
        uploadId: req.params.uploadId,
        index: req.params.index,
        buffer: req.body,
      });
      res.status(200).json(result);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  };

  complete = async (req, res) => {
    try {
      const { replyToMessageId } = req.body;
      const message = await this.completeUploadUseCase.execute({
        requester: req.user,
        uploadId: req.params.uploadId,
        replyToMessageId: replyToMessageId ? Number(replyToMessageId) : undefined,
      });
      res.status(201).json(message);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  };

  abort = async (req, res) => {
    try {
      const result = await this.abortUploadUseCase.execute({ requester: req.user, uploadId: req.params.uploadId });
      res.status(200).json(result);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  };

  status = async (req, res) => {
    try {
      const result = await this.statusUploadUseCase.execute({ requester: req.user, uploadId: req.params.uploadId });
      res.status(200).json(result);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  };
}

export { UploadsController };
