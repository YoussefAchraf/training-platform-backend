class ConversationMediaController {
  listConversationMediaUseCase: any;

  constructor({ listConversationMediaUseCase }) {
    this.listConversationMediaUseCase = listConversationMediaUseCase;
  }

  list = async (req, res) => {
    try {
      const cursor = req.query.cursor ? Number(req.query.cursor) : undefined;
      const limit = req.query.limit ? Number(req.query.limit) : undefined;
      const messages = await this.listConversationMediaUseCase.execute({
        requester: req.user,
        conversationId: Number(req.params.id),
        filter: req.query.filter,
        cursor,
        limit,
      });
      res.status(200).json(messages);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  };
}

export { ConversationMediaController };
