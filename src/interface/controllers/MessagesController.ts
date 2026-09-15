class MessagesController {
  sendMessageUseCase: any;
  listMessagesUseCase: any;

  constructor({ sendMessageUseCase, listMessagesUseCase }) {
    this.sendMessageUseCase = sendMessageUseCase;
    this.listMessagesUseCase = listMessagesUseCase;
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
      const { type, body, replyToMessageId, attachment } = req.body;
      const message = await this.sendMessageUseCase.execute({
        requester: req.user,
        conversationId: Number(req.params.id),
        type,
        body,
        replyToMessageId,
        attachment,
      });
      res.status(201).json(message);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  };
}

export { MessagesController };
