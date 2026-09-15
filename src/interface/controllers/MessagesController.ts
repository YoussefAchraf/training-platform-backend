class MessagesController {
  sendMessageUseCase: any;
  listMessagesUseCase: any;
  translateMessageUseCase: any;
  forwardMessageUseCase: any;

  constructor({ sendMessageUseCase, listMessagesUseCase, translateMessageUseCase, forwardMessageUseCase }) {
    this.sendMessageUseCase = sendMessageUseCase;
    this.listMessagesUseCase = listMessagesUseCase;
    this.translateMessageUseCase = translateMessageUseCase;
    this.forwardMessageUseCase = forwardMessageUseCase;
  }

  list = async (req, res) => {
    try {
      const cursor = req.query.cursor ? Number(req.query.cursor) : undefined;
      const limit = req.query.limit ? Number(req.query.limit) : undefined;
      const messages = await this.listMessagesUseCase.execute({
        requester: req.user,
        conversationId: Number(req.params.id),
        cursor,
        limit,
      });
      res.status(200).json(messages);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  };

  send = async (req, res) => {
    try {
      const { type, body, replyToMessageId } = req.body;
      const attachment = req.file
        ? { key: req.file.filename, originalName: req.file.originalname, sizeBytes: req.file.size }
        : undefined;

      const message = await this.sendMessageUseCase.execute({
        requester: req.user,
        conversationId: Number(req.params.id),
        type,
        body,
        replyToMessageId: replyToMessageId ? Number(replyToMessageId) : undefined,
        attachment,
      });
      res.status(201).json(message);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  };

  translate = async (req, res) => {
    try {
      const result = await this.translateMessageUseCase.execute({
        requester: req.user,
        messageId: Number(req.params.messageId),
        targetLanguage: req.body.targetLanguage,
      });
      res.status(200).json(result);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  };

  forward = async (req, res) => {
    try {
      const message = await this.forwardMessageUseCase.execute({
        requester: req.user,
        messageId: Number(req.params.messageId),
        targetConversationId: Number(req.body.targetConversationId),
      });
      res.status(201).json(message);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  };
}

export { MessagesController };
