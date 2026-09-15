class SetConversationMutedUseCase {
  conversationRepository: any;
  messagingRealtime: any;

  constructor({ conversationRepository, messagingRealtime = null }) {
    this.conversationRepository = conversationRepository;
    this.messagingRealtime = messagingRealtime;
  }

  async execute({ requester, conversationId, muted }: { requester: any; conversationId: any; muted: boolean }) {
    if (requester.isSuperAdmin()) {
      throw new Error('SuperAdmin cannot access messaging');
    }

    const isParticipant = await this.conversationRepository.isParticipant(conversationId, requester.id);
    if (!isParticipant) {
      throw new Error('You are not a participant of this conversation');
    }

    await this.conversationRepository.setMuted(conversationId, requester.id, Boolean(muted));
    this.messagingRealtime?.notifyConversationMuted(requester.id, conversationId, Boolean(muted));

    return { conversationId, muted: Boolean(muted) };
  }
}

export { SetConversationMutedUseCase };
