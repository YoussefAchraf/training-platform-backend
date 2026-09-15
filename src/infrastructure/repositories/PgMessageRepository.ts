import { Message } from '../../domain/entities/Message';
import { IMessageRepository } from '../../domain/interfaces/IMessageRepository';

const SENDER_INCLUDE = { sender: { select: { firstname: true, lastname: true } } };

function mapRow(row) {
  if (!row) return null;
  return new Message({
    id: row.id,
    conversationId: row.conversation_id,
    senderId: row.sender_id,
    senderName: row.sender ? `${row.sender.firstname} ${row.sender.lastname}` : null,
    type: row.type,
    body: row.body,
    attachmentKey: row.attachment_key,
    attachmentOriginalName: row.attachment_original_name,
    attachmentMime: row.attachment_mime,
    attachmentSizeBytes: row.attachment_size_bytes,
    attachmentDurationSeconds: row.attachment_duration_seconds,
    replyToMessageId: row.reply_to_message_id,
    createdAt: row.created_at,
    editedAt: row.edited_at,
  });
}

class PgMessageRepository extends IMessageRepository {
  prisma: any;

  constructor(prisma) {
    super();
    this.prisma = prisma;
  }

  async create(message) {
    const row = await this.prisma.messages.create({
      data: {
        conversation_id: message.conversationId,
        sender_id: message.senderId,
        type: message.type,
        body: message.body || null,
        attachment_key: message.attachmentKey || null,
        attachment_original_name: message.attachmentOriginalName || null,
        attachment_mime: message.attachmentMime || null,
        attachment_size_bytes: message.attachmentSizeBytes || null,
        attachment_duration_seconds: message.attachmentDurationSeconds || null,
        reply_to_message_id: message.replyToMessageId || null,
      },
      include: SENDER_INCLUDE,
    });
    return mapRow(row);
  }

  async findById(id) {
    const row = await this.prisma.messages.findUnique({ where: { id }, include: SENDER_INCLUDE });
    return mapRow(row);
  }

  async listByConversation(conversationId, { cursor, limit = 50 }: { cursor?: number; limit?: number } = {}) {
    const rows = await this.prisma.messages.findMany({
      where: { conversation_id: conversationId, ...(cursor ? { id: { lt: cursor } } : {}) },
      include: SENDER_INCLUDE,
      orderBy: { id: 'desc' },
      take: limit,
    });
    return rows.map(mapRow).reverse();
  }

  async countUnread(conversationId, afterMessageId) {
    return this.prisma.messages.count({
      where: { conversation_id: conversationId, id: { gt: afterMessageId || 0 } },
    });
  }

  async update(id, { body }) {
    const row = await this.prisma.messages.update({
      where: { id },
      data: { body, edited_at: new Date() },
      include: SENDER_INCLUDE,
    });
    return mapRow(row);
  }
}

export { PgMessageRepository };
