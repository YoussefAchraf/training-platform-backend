class ConversationsController {
  createDirectConversationUseCase: any;
  createGroupConversationUseCase: any;
  addParticipantUseCase: any;
  removeParticipantUseCase: any;
  listConversationsUseCase: any;
  markConversationReadUseCase: any;

  constructor({
    createDirectConversationUseCase,
    createGroupConversationUseCase,
    addParticipantUseCase,
    removeParticipantUseCase,
    listConversationsUseCase,
    markConversationReadUseCase,
  }) {
    this.createDirectConversationUseCase = createDirectConversationUseCase;
    this.createGroupConversationUseCase = createGroupConversationUseCase;
    this.addParticipantUseCase = addParticipantUseCase;
    this.removeParticipantUseCase = removeParticipantUseCase;
    this.listConversationsUseCase = listConversationsUseCase;
    this.markConversationReadUseCase = markConversationReadUseCase;
  }

  list = async (req, res) => {
    try {
      const conversations = await this.listConversationsUseCase.execute({ requester: req.user });
      res.status(200).json(conversations);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  };

  createDirect = async (req, res) => {
    try {
      const { targetUserId } = req.body;
      const conversation = await this.createDirectConversationUseCase.execute({ requester: req.user, targetUserId });
      res.status(201).json(conversation);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  };

  createGroup = async (req, res) => {
    try {
      const { name, memberUserIds } = req.body;
      const conversation = await this.createGroupConversationUseCase.execute({ requester: req.user, name, memberUserIds });
      res.status(201).json(conversation);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  };

  addParticipant = async (req, res) => {
    try {
      const { userId } = req.body;
      const participant = await this.addParticipantUseCase.execute({
        requester: req.user,
        conversationId: Number(req.params.id),
        userId,
      });
      res.status(201).json(participant);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  };

  removeParticipant = async (req, res) => {
    try {
      await this.removeParticipantUseCase.execute({
        requester: req.user,
        conversationId: Number(req.params.id),
        userId: Number(req.params.userId),
      });
      res.status(204).send();
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  };

  markRead = async (req, res) => {
    try {
      const { messageId } = req.body;
      const participant = await this.markConversationReadUseCase.execute({
        requester: req.user,
        conversationId: Number(req.params.id),
        messageId,
      });
      res.status(200).json(participant);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  };
}

export { ConversationsController };
