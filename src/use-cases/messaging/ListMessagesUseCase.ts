class ListMessagesUseCase {
  conversationRepository: any;
  messageRepository: any;
  messagingRealtime: any;

  constructor({ conversationRepository, messageRepository, messagingRealtime = null }) {
    this.conversationRepository = conversationRepository;
    this.messageRepository = messageRepository;
    this.messagingRealtime = messagingRealtime;
  }

  async execute({
    requester,
    conversationId,
    cursor,
    limit,
    search,
  }: {
    requester: any;
    conversationId: any;
    cursor?: number;
    limit?: number;
    search?: string;
  }) {
    if (requester.isSuperAdmin()) {
      throw new Error('SuperAdmin cannot access messaging');
    }

    const isParticipant = await this.conversationRepository.isParticipant(conversationId, requester.id);
    if (!isParticipant) {
      throw new Error('You are not a participant of this conversation');
    }

    const messages = await this.messageRepository.listByConversation(conversationId, {
      cursor,
      limit,
      requesterId: requester.id,
      search,
    });

    if (!search) {
      const newestMessage = messages[messages.length - 1];
      if (newestMessage) {
        this.markDeliveredForLatest(conversationId, requester.id, newestMessage.id).catch((err) => {
          console.error('[ListMessages] Failed to mark delivered:', err.message);
        });
      }
    }

    return messages;
  }

  async markDeliveredForLatest(conversationId, userId, messageId) {
    const participant = await this.conversationRepository.markDelivered(conversationId, userId, messageId);
    this.messagingRealtime?.broadcastDelivered(conversationId, participant);
  }
}

export { ListMessagesUseCase };
