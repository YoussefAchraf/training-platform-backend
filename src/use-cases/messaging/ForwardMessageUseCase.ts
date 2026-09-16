import { MESSAGING_ALLOWED_ROLES } from '../../domain/constants/messagingRoles';

const ATTACHMENT_LABELS = { image: 'Sent a photo', voice: 'Sent a voice message', file: 'Sent a file' };

class ForwardMessageUseCase {
  conversationRepository: any;
  messageRepository: any;
  messagingRealtime: any;
  presenceStore: any;
  pushSubscriptionRepository: any;
  webPushService: any;

  constructor({
    conversationRepository,
    messageRepository,
    messagingRealtime = null,
    presenceStore = null,
    pushSubscriptionRepository = null,
    webPushService = null,
  }) {
    this.conversationRepository = conversationRepository;
    this.messageRepository = messageRepository;
    this.messagingRealtime = messagingRealtime;
    this.presenceStore = presenceStore;
    this.pushSubscriptionRepository = pushSubscriptionRepository;
    this.webPushService = webPushService;
  }

  async execute({
    requester,
    messageId,
    targetConversationId,
  }: {
    requester: any;
    messageId: any;
    targetConversationId: any;
  }) {
    if (requester.isSuperAdmin()) {
      throw new Error('SuperAdmin cannot access messaging');
    }
    if (!MESSAGING_ALLOWED_ROLES.includes(requester.roleName)) {
      throw new Error('Only Manager and Instructor can use messaging');
    }

    const original = await this.messageRepository.findById(messageId);
    if (!original) {
      throw new Error('Message not found');
    }

    const isSourceParticipant = await this.conversationRepository.isParticipant(original.conversationId, requester.id);
    if (!isSourceParticipant) {
      throw new Error('You are not a participant of the source conversation');
    }

    const isTargetParticipant = await this.conversationRepository.isParticipant(targetConversationId, requester.id);
    if (!isTargetParticipant) {
      throw new Error('You are not a participant of the target conversation');
    }

    const forwarded = await this.messageRepository.create({
      conversationId: targetConversationId,
      senderId: requester.id,
      type: original.type,
      body: original.body,
      attachmentKey: original.attachmentKey,
      attachmentOriginalName: original.attachmentOriginalName,
      attachmentMime: original.attachmentMime,
      attachmentSizeBytes: original.attachmentSizeBytes,
      attachmentDurationSeconds: original.attachmentDurationSeconds,
      replyToMessageId: null,
    });

    this.messagingRealtime?.broadcastMessage(targetConversationId, forwarded);
    this.notifyOfflineParticipants(targetConversationId, requester, forwarded).catch((err) => {
      console.error('[ForwardMessage] Failed to notify offline participants:', err.message);
    });

    return forwarded;
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
                console.error('[ForwardMessage] Failed to send push notification:', err.message);
              })
          )
        );
      })
    );
  }
}

export { ForwardMessageUseCase };
