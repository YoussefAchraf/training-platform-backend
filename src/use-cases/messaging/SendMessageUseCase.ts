import { MESSAGING_ALLOWED_ROLES } from '../../domain/constants/messagingRoles';

const VALID_TYPES = ['text', 'image', 'voice', 'file'];
const ATTACHMENT_LABELS = { image: 'Sent a photo', voice: 'Sent a voice message', file: 'Sent a file' };

class SendMessageUseCase {
  conversationRepository: any;
  messageRepository: any;
  messagingRealtime: any;
  presenceStore: any;
  pushSubscriptionRepository: any;
  webPushService: any;

  attachmentStorageService: any;

  constructor({
    conversationRepository,
    messageRepository,
    messagingRealtime = null,
    presenceStore = null,
    pushSubscriptionRepository = null,
    webPushService = null,
    attachmentStorageService = null,
  }) {
    this.conversationRepository = conversationRepository;
    this.messageRepository = messageRepository;
    this.messagingRealtime = messagingRealtime;
    this.presenceStore = presenceStore;
    this.pushSubscriptionRepository = pushSubscriptionRepository;
    this.webPushService = webPushService;
    this.attachmentStorageService = attachmentStorageService;
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

    let trustedMime = attachment?.mime;
    let trustedSizeBytes = attachment?.sizeBytes;
    if (attachment && this.attachmentStorageService) {
      try {
        const validated = await this.attachmentStorageService.validateUploadedFile(conversationId, attachment.key, type);
        trustedMime = validated.mime;
        trustedSizeBytes = validated.sizeBytes;
      } catch (err) {
        await this.attachmentStorageService.delete(conversationId, attachment.key);
        throw err;
      }
    }

    const message = await this.messageRepository.create({
      conversationId,
      senderId: requester.id,
      type,
      body: type === 'text' ? body.trim() : null,
      attachmentKey: attachment?.key,
      attachmentOriginalName: attachment?.originalName,
      attachmentMime: trustedMime,
      attachmentSizeBytes: trustedSizeBytes,
      attachmentDurationSeconds: attachment?.durationSeconds,
      replyToMessageId: replyToMessageId || null,
    });

    this.messagingRealtime?.broadcastMessage(conversationId, message);
    this.notifyOfflineParticipants(conversationId, requester, message).catch((err) => {
      console.error('[SendMessage] Failed to notify offline participants:', err.message);
    });

    return message;
  }

  async notifyOfflineParticipants(conversationId, sender, message) {
    if (!this.presenceStore || !this.pushSubscriptionRepository || !this.webPushService) return;

    const participants = await this.conversationRepository.listParticipants(conversationId);
    const recipients = participants.filter((p) => Number(p.userId) !== Number(sender.id));

    await Promise.all(
      recipients.map(async (participant) => {
        if (participant.mutedAt) return;

        const online = await this.presenceStore.isOnline(participant.userId);
        if (online) return;

        const subscriptions = await this.pushSubscriptionRepository.listByUserId(participant.userId);
        await Promise.all(
          subscriptions.map((subscription) =>
            this.webPushService
              .send(subscription, {
                title: `${sender.firstname} ${sender.lastname}`,
                body: message.type === 'text' ? message.body : ATTACHMENT_LABELS[message.type],
                url: '/messages',
              })
              .catch((err) => {
                if (err.expired) {
                  return this.pushSubscriptionRepository.deleteByEndpointForUser(subscription.endpoint, participant.userId);
                }
                console.error('[SendMessage] Failed to send push notification:', err.message);
              })
          )
        );
      })
    );
  }
}

export { SendMessageUseCase };
