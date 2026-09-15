import { conversationRoom, userRoom } from './SocketServer';

class MessagingRealtimeGateway {
  messaging: any;

  constructor({ messaging }) {
    this.messaging = messaging;
  }

  broadcastMessage(conversationId, message) {
    this.messaging?.to(conversationRoom(conversationId)).emit('message:new', { message });
  }

  broadcastMessageUpdated(conversationId, message) {
    this.messaging?.to(conversationRoom(conversationId)).emit('message:updated', { message });
  }

  async notifyParticipantAdded(conversationId, conversation, participant) {
    if (!this.messaging) return;
    await this.messaging.in(userRoom(participant.userId)).socketsJoin(conversationRoom(conversationId));
    this.messaging.to(userRoom(participant.userId)).emit('conversation:new', { conversation });
    this.messaging.to(conversationRoom(conversationId)).emit('participant:added', { conversationId, participant });
  }

  async notifyGroupCreated(conversation, createdByUserId) {
    if (!this.messaging) return;
    await Promise.all(
      conversation.participants
        .filter((p) => Number(p.userId) !== Number(createdByUserId))
        .map(async (participant) => {
          await this.messaging.in(userRoom(participant.userId)).socketsJoin(conversationRoom(conversation.id));
          this.messaging.to(userRoom(participant.userId)).emit('conversation:new', { conversation });
        })
    );
  }

  async notifyParticipantRemoved(conversationId, userId) {
    if (!this.messaging) return;
    this.messaging.to(conversationRoom(conversationId)).emit('participant:removed', { conversationId, userId });
    await this.messaging.in(userRoom(userId)).socketsLeave(conversationRoom(conversationId));
  }

  broadcastRead(conversationId, participant) {
    this.messaging?.to(conversationRoom(conversationId)).emit('conversation:read', {
      conversationId,
      userId: participant.userId,
      lastReadMessageId: participant.lastReadMessageId,
      lastReadAt: participant.lastReadAt,
    });
  }

  broadcastDelivered(conversationId, participant) {
    this.messaging?.to(conversationRoom(conversationId)).emit('conversation:delivered', {
      conversationId,
      userId: participant.userId,
      lastDeliveredMessageId: participant.lastDeliveredMessageId,
      lastDeliveredAt: participant.lastDeliveredAt,
    });
  }

  broadcastMessageDeleted(conversationId, messageId, scope) {
    this.messaging?.to(conversationRoom(conversationId)).emit('message:deleted', { conversationId, messageId, scope });
  }

  notifyMessageHiddenForUser(userId, conversationId, messageId) {
    this.messaging?.to(userRoom(userId)).emit('message:deleted', { conversationId, messageId, scope: 'me' });
  }
}

export { MessagingRealtimeGateway };
