class HideConversationUseCase {
  conversationRepository: any;
  messagingRealtime: any;

  constructor({ conversationRepository, messagingRealtime = null }) {
    this.conversationRepository = conversationRepository;
    this.messagingRealtime = messagingRealtime;
  }

  async execute({ requester, conversationId }: { requester: any; conversationId: any }) {
    if (requester.isSuperAdmin()) {
      throw new Error('SuperAdmin cannot access messaging');
    }

    const isParticipant = await this.conversationRepository.isParticipant(conversationId, requester.id);
    if (!isParticipant) {
      throw new Error('You are not a participant of this conversation');
    }

    await this.conversationRepository.hideConversation(conversationId, requester.id);
    this.messagingRealtime?.notifyConversationHidden(requester.id, conversationId);

    return { conversationId };
  }
}

export { HideConversationUseCase };
