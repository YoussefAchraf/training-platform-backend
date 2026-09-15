class MarkConversationReadUseCase {
  conversationRepository: any;
  messagingRealtime: any;

  constructor({ conversationRepository, messagingRealtime = null }) {
    this.conversationRepository = conversationRepository;
    this.messagingRealtime = messagingRealtime;
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

    const participant = await this.conversationRepository.markRead(conversationId, requester.id, messageId);
    this.messagingRealtime?.broadcastRead(requester.id, conversationId, participant.lastReadMessageId);

    return participant;
  }
}

export { MarkConversationReadUseCase };
