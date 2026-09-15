class MarkConversationReadUseCase {
  conversationRepository: any;

  constructor({ conversationRepository }) {
    this.conversationRepository = conversationRepository;
  }

  async execute({ requester, conversationId, messageId }: { requester: any; conversationId: any; messageId: any }) {
    if (requester.isSuperAdmin()) {
      throw new Error('SuperAdmin cannot access messaging');
    }
    if (!messageId) {
      throw new Error('A message id to mark as read is required');
    }

    const isParticipant = await this.conversationRepository.isParticipant(conversationId, requester.id);
    if (!isParticipant) {
      throw new Error('You are not a participant of this conversation');
    }

    return this.conversationRepository.markRead(conversationId, requester.id, messageId);
  }
}

export { MarkConversationReadUseCase };
