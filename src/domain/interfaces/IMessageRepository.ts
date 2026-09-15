import { notImplemented } from './notImplemented';

class IMessageRepository {
  async create(message): Promise<any> { notImplemented('IMessageRepository', 'create'); }
  async findById(id): Promise<any> { notImplemented('IMessageRepository', 'findById'); }
  async listByConversation(conversationId, params): Promise<any> { notImplemented('IMessageRepository', 'listByConversation'); }
  async countUnread(conversationId, afterMessageId): Promise<any> { notImplemented('IMessageRepository', 'countUnread'); }
  async update(id, changes): Promise<any> { notImplemented('IMessageRepository', 'update'); }
  async softDeleteForEveryone(id): Promise<any> { notImplemented('IMessageRepository', 'softDeleteForEveryone'); }
  async hideForUser(messageId, userId): Promise<any> { notImplemented('IMessageRepository', 'hideForUser'); }
}

export { IMessageRepository };
