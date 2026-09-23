import { notImplemented } from './notImplemented';

class IConversationRepository {
  async findDirectConversationBetween(userIdA, userIdB): Promise<any> { notImplemented('IConversationRepository', 'findDirectConversationBetween'); }
  async createDirect(params): Promise<any> { notImplemented('IConversationRepository', 'createDirect'); }
  async createGroup(params): Promise<any> { notImplemented('IConversationRepository', 'createGroup'); }
  async findById(id): Promise<any> { notImplemented('IConversationRepository', 'findById'); }
  async isParticipant(conversationId, userId): Promise<any> { notImplemented('IConversationRepository', 'isParticipant'); }
  async listParticipants(conversationId): Promise<any> { notImplemented('IConversationRepository', 'listParticipants'); }
  async addParticipant(conversationId, userId, role): Promise<any> { notImplemented('IConversationRepository', 'addParticipant'); }
  async removeParticipant(conversationId, userId): Promise<any> { notImplemented('IConversationRepository', 'removeParticipant'); }
  async listForUser(userId): Promise<any> { notImplemented('IConversationRepository', 'listForUser'); }
  async markRead(conversationId, userId, messageId): Promise<any> { notImplemented('IConversationRepository', 'markRead'); }
  async markDelivered(conversationId, userId, messageId): Promise<any> { notImplemented('IConversationRepository', 'markDelivered'); }
  async hideConversation(conversationId, userId): Promise<any> { notImplemented('IConversationRepository', 'hideConversation'); }
  async unhideConversation(conversationId, userId): Promise<any> { notImplemented('IConversationRepository', 'unhideConversation'); }
  async setMuted(conversationId, userId, muted): Promise<any> { notImplemented('IConversationRepository', 'setMuted'); }
  async listReachablePeople(params): Promise<any> { notImplemented('IConversationRepository', 'listReachablePeople'); }
}

export { IConversationRepository };
