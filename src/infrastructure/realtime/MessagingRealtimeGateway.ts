import { conversationRoom, userRoom } from './SocketServer';

class MessagingRealtimeGateway {
  messaging: any;

  constructor({ messaging }) {
    this.messaging = messaging;
  }

  broadcastMessage(conversationId, message) {
    this.messaging?.to(conversationRoom(conversationId)).emit('message:new', { message });
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

  broadcastRead(userId, conversationId, lastReadMessageId) {
    this.messaging?.to(userRoom(userId)).emit('conversation:read', { conversationId, lastReadMessageId });
  }
}

export { MessagingRealtimeGateway };
