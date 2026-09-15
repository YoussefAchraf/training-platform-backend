import { MESSAGING_ALLOWED_ROLES } from '../../domain/constants/messagingRoles';

const VALID_TYPES = ['text', 'image', 'voice', 'file'];

class SendMessageUseCase {
  conversationRepository: any;
  messageRepository: any;

  constructor({ conversationRepository, messageRepository }) {
    this.conversationRepository = conversationRepository;
    this.messageRepository = messageRepository;
  }

  async execute({
    requester,
    conversationId,
    type = 'text',
    body,
    replyToMessageId,
    attachment,
  }: {
    requester: any;
    conversationId: any;
    type?: string;
    body?: string;
    replyToMessageId?: any;
    attachment?: any;
  }) {
    if (requester.isSuperAdmin()) {
      throw new Error('SuperAdmin cannot access messaging');
    }
    if (!MESSAGING_ALLOWED_ROLES.includes(requester.roleName)) {
      throw new Error('Only Manager and Instructor can use messaging');
    }
    if (!VALID_TYPES.includes(type)) {
      throw new Error('Invalid message type');
    }

    const isParticipant = await this.conversationRepository.isParticipant(conversationId, requester.id);
    if (!isParticipant) {
      throw new Error('You are not a participant of this conversation');
    }

    if (type === 'text' && (!body || !body.trim())) {
      throw new Error('Message body is required');
    }
    if (type !== 'text' && !attachment) {
      throw new Error('An attachment is required for this message type');
    }

    if (replyToMessageId) {
      const replyTarget = await this.messageRepository.findById(replyToMessageId);
      if (!replyTarget || Number(replyTarget.conversationId) !== Number(conversationId)) {
        throw new Error('The message being replied to was not found in this conversation');
      }
    }

    return this.messageRepository.create({
      conversationId,
      senderId: requester.id,
      type,
      body: type === 'text' ? body.trim() : null,
      attachmentKey: attachment?.key,
      attachmentOriginalName: attachment?.originalName,
      attachmentMime: attachment?.mime,
      attachmentSizeBytes: attachment?.sizeBytes,
      attachmentDurationSeconds: attachment?.durationSeconds,
      replyToMessageId: replyToMessageId || null,
    });
  }
}

export { SendMessageUseCase };
