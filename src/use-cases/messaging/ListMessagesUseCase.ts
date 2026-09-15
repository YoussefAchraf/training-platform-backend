class ListMessagesUseCase {
  conversationRepository: any;
  messageRepository: any;

  constructor({ conversationRepository, messageRepository }) {
    this.conversationRepository = conversationRepository;
    this.messageRepository = messageRepository;
  }

  async execute({
    requester,
    conversationId,
    cursor,
    limit,
  }: {
    requester: any;
    conversationId: any;
    cursor?: number;
    limit?: number;
  }) {
    if (requester.isSuperAdmin()) {
      throw new Error('SuperAdmin cannot access messaging');
    }

    const isParticipant = await this.conversationRepository.isParticipant(conversationId, requester.id);
    if (!isParticipant) {
      throw new Error('You are not a participant of this conversation');
    }

    return this.messageRepository.listByConversation(conversationId, { cursor, limit });
  }
}

export { ListMessagesUseCase };
