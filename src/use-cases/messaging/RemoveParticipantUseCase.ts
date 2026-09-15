class RemoveParticipantUseCase {
  conversationRepository: any;
  messagingRealtime: any;

  constructor({ conversationRepository, messagingRealtime = null }) {
    this.conversationRepository = conversationRepository;
    this.messagingRealtime = messagingRealtime;
  }

  async execute({ requester, conversationId, userId }: { requester: any; conversationId: any; userId: any }) {
    if (requester.isSuperAdmin()) {
      throw new Error('SuperAdmin cannot access messaging');
    }
    if (!requester.isManager()) {
      throw new Error('Only a Manager can remove a participant');
    }

    const conversation = await this.conversationRepository.findById(conversationId);
    if (!conversation || conversation.type !== 'group') {
      throw new Error('Group not found');
    }
    const requesterParticipant = conversation.participants.find((p) => Number(p.userId) === Number(requester.id));
    if (!requesterParticipant || requesterParticipant.role !== 'owner') {
      throw new Error('Only the group owner can remove a participant');
    }
    if (Number(userId) === Number(requester.id)) {
      throw new Error('The group owner cannot be removed');
    }
    if (!conversation.participants.some((p) => Number(p.userId) === Number(userId))) {
      throw new Error('This user is not in the group');
    }

    await this.conversationRepository.removeParticipant(conversationId, userId);
    this.messagingRealtime?.notifyParticipantRemoved(conversationId, userId).catch((err) => {
      console.error('[RemoveParticipant] Failed to notify participant removal in real time:', err.message);
    });
  }
}

export { RemoveParticipantUseCase };
