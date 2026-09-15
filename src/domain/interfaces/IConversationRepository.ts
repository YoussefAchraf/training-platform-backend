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
  async listReachablePeople(params): Promise<any> { notImplemented('IConversationRepository', 'listReachablePeople'); }
}

export { IConversationRepository };
