const DELETE_FOR_EVERYONE_WINDOW_MS = 2 * 60 * 1000;

class DeleteMessageUseCase {
  conversationRepository: any;
  messageRepository: any;
  attachmentStorageService: any;
  messagingRealtime: any;

  constructor({ conversationRepository, messageRepository, attachmentStorageService = null, messagingRealtime = null }) {
    this.conversationRepository = conversationRepository;
    this.messageRepository = messageRepository;
    this.attachmentStorageService = attachmentStorageService;
    this.messagingRealtime = messagingRealtime;
  }

  async execute({ requester, messageId, scope }: { requester: any; messageId: any; scope: 'me' | 'everyone' }) {
    if (requester.isSuperAdmin()) {
      throw new Error('SuperAdmin cannot access messaging');
    }
    if (scope !== 'me' && scope !== 'everyone') {
      throw new Error('Invalid delete scope');
    }

    const message = await this.messageRepository.findById(messageId);
    if (!message) {
      throw new Error('Message not found');
    }

    const isParticipant = await this.conversationRepository.isParticipant(message.conversationId, requester.id);
    if (!isParticipant) {
      throw new Error('You are not a participant of this conversation');
    }

    if (scope === 'everyone') {
      if (Number(message.senderId) !== Number(requester.id)) {
        throw new Error('You can only delete your own messages for everyone');
      }
      const elapsedMs = Date.now() - new Date(message.createdAt).getTime();
      if (elapsedMs > DELETE_FOR_EVERYONE_WINDOW_MS) {
        throw new Error('This message can no longer be deleted for everyone');
      }

      const updated = await this.messageRepository.softDeleteForEveryone(messageId);
      if (message.attachmentKey && this.attachmentStorageService) {
        this.attachmentStorageService.delete(message.conversationId, message.attachmentKey).catch((err) => {
          console.error('[DeleteMessage] Failed to remove attachment file:', err.message);
        });
      }
      this.messagingRealtime?.broadcastMessageDeleted(message.conversationId, messageId, 'everyone');
      return updated;
    }

    await this.messageRepository.hideForUser(messageId, requester.id);
    this.messagingRealtime?.notifyMessageHiddenForUser(requester.id, message.conversationId, messageId);
    return { id: messageId, scope: 'me' };
  }
}

export { DeleteMessageUseCase };
