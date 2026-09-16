class DownloadAttachmentUseCase {
  conversationRepository: any;
  messageRepository: any;

  constructor({ conversationRepository, messageRepository }) {
    this.conversationRepository = conversationRepository;
    this.messageRepository = messageRepository;
  }

  async execute({ requester, messageId }: { requester: any; messageId: any }) {
    if (requester.isSuperAdmin()) {
      throw new Error('SuperAdmin cannot access messaging');
    }

    const message = await this.messageRepository.findById(messageId);
    if (!message || !message.attachmentKey) {
      throw new Error('Attachment not found');
    }

    const isParticipant = await this.conversationRepository.isParticipant(message.conversationId, requester.id);
    if (!isParticipant) {
      throw new Error('You are not a participant of this conversation');
    }

    return message;
  }
}

export { DownloadAttachmentUseCase };
