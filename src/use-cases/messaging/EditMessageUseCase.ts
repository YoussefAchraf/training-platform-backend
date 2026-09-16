class EditMessageUseCase {
  conversationRepository: any;
  messageRepository: any;
  messagingRealtime: any;

  constructor({ conversationRepository, messageRepository, messagingRealtime = null }) {
    this.conversationRepository = conversationRepository;
    this.messageRepository = messageRepository;
    this.messagingRealtime = messagingRealtime;
  }

  async execute({ requester, messageId, body }: { requester: any; messageId: any; body: any }) {
    if (requester.isSuperAdmin()) {
      throw new Error('SuperAdmin cannot access messaging');
    }

    const message = await this.messageRepository.findById(messageId);
    if (!message) {
      throw new Error('Message not found');
    }

    const isParticipant = await this.conversationRepository.isParticipant(message.conversationId, requester.id);
    if (!isParticipant) {
      throw new Error('You are not a participant of this conversation');
    }

    if (Number(message.senderId) !== Number(requester.id)) {
      throw new Error('You can only edit your own messages');
    }
    if (message.type !== 'text') {
      throw new Error('Only text messages can be edited');
    }
    if (!body || !body.trim()) {
      throw new Error('Message body is required');
    }

    const updated = await this.messageRepository.update(messageId, { body: body.trim() });
    this.messagingRealtime?.broadcastMessageUpdated(message.conversationId, updated);

    return updated;
  }
}

export { EditMessageUseCase };
