const VALID_FILTERS = ['media', 'files', 'links'];

class ListConversationMediaUseCase {
  conversationRepository: any;
  messageRepository: any;

  constructor({ conversationRepository, messageRepository }) {
    this.conversationRepository = conversationRepository;
    this.messageRepository = messageRepository;
  }

  async execute({
    requester,
    conversationId,
    filter,
    cursor,
    limit,
  }: {
    requester: any;
    conversationId: any;
    filter: string;
    cursor?: number;
    limit?: number;
  }) {
    if (requester.isSuperAdmin()) {
      throw new Error('SuperAdmin cannot access messaging');
    }
    if (!VALID_FILTERS.includes(filter)) {
      throw new Error('Invalid media filter');
    }

    const isParticipant = await this.conversationRepository.isParticipant(conversationId, requester.id);
    if (!isParticipant) {
      throw new Error('You are not a participant of this conversation');
    }

    return this.messageRepository.listByConversationFiltered(conversationId, {
      filter,
      cursor,
      limit,
      requesterId: requester.id,
    });
  }
}

export { ListConversationMediaUseCase };
