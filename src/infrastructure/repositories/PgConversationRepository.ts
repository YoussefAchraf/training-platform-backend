import { Conversation } from '../../domain/entities/Conversation';
import { ConversationParticipant } from '../../domain/entities/ConversationParticipant';
import { IConversationRepository } from '../../domain/interfaces/IConversationRepository';

const PARTICIPANT_USER_SELECT = {
  select: { id: true, firstname: true, lastname: true, email: true, roles: { select: { name: true } } },
};

const PARTICIPANTS_INCLUDE = { participants: { include: { users: PARTICIPANT_USER_SELECT } } };

function mapParticipantRow(row) {
  return new ConversationParticipant({
    conversationId: row.conversation_id,
    userId: row.user_id,
    role: row.role,
    joinedAt: row.joined_at,
    lastReadMessageId: row.last_read_message_id,
    lastReadAt: row.last_read_at,
    firstname: row.users?.firstname,
    lastname: row.users?.lastname,
    email: row.users?.email,
    roleName: row.users?.roles?.name,
  });
}

function mapConversationRow(row, unreadCount = 0) {
  if (!row) return null;
  const lastMessageRow = row.messages?.[0];
  return new Conversation({
    id: row.id,
    type: row.type,
    name: row.name,
    createdBy: row.created_by,
    createdAt: row.created_at,
    participants: (row.participants || []).map(mapParticipantRow),
    lastMessage: lastMessageRow
      ? {
          id: lastMessageRow.id,
          type: lastMessageRow.type,
          body: lastMessageRow.body,
          senderId: lastMessageRow.sender_id,
          createdAt: lastMessageRow.created_at,
        }
      : null,
    unreadCount,
  });
}

class PgConversationRepository extends IConversationRepository {
  prisma: any;

  constructor(prisma) {
    super();
    this.prisma = prisma;
  }

  async findDirectConversationBetween(userIdA, userIdB) {
    const row = await this.prisma.conversations.findFirst({
      where: {
        type: 'direct',
        participants: { some: { user_id: userIdA } },
        AND: [{ participants: { some: { user_id: userIdB } } }],
      },
      include: PARTICIPANTS_INCLUDE,
    });
    return mapConversationRow(row);
  }

  async createDirect({ createdBy, participantUserIds }) {
    const row = await this.prisma.conversations.create({
      data: {
        type: 'direct',
        created_by: createdBy,
        participants: { create: participantUserIds.map((userId) => ({ user_id: userId, role: 'member' })) },
      },
      include: PARTICIPANTS_INCLUDE,
    });
    return mapConversationRow(row);
  }

  async createGroup({ createdBy, name, memberUserIds }) {
    const row = await this.prisma.conversations.create({
      data: {
        type: 'group',
        name,
        created_by: createdBy,
        participants: {
          create: [
            { user_id: createdBy, role: 'owner' },
            ...memberUserIds.map((userId) => ({ user_id: userId, role: 'member' })),
          ],
        },
      },
      include: PARTICIPANTS_INCLUDE,
    });
    return mapConversationRow(row);
  }

  async findById(id) {
    const row = await this.prisma.conversations.findUnique({ where: { id }, include: PARTICIPANTS_INCLUDE });
    return mapConversationRow(row);
  }

  async isParticipant(conversationId, userId) {
    const row = await this.prisma.conversation_participants.findUnique({
      where: { conversation_id_user_id: { conversation_id: conversationId, user_id: userId } },
    });
    return Boolean(row);
  }

  async listParticipants(conversationId) {
    const rows = await this.prisma.conversation_participants.findMany({
      where: { conversation_id: conversationId },
      include: { users: PARTICIPANT_USER_SELECT },
    });
    return rows.map(mapParticipantRow);
  }

  async addParticipant(conversationId, userId, role = 'member') {
    const row = await this.prisma.conversation_participants.create({
      data: { conversation_id: conversationId, user_id: userId, role },
      include: { users: PARTICIPANT_USER_SELECT },
    });
    return mapParticipantRow(row);
  }

  async removeParticipant(conversationId, userId) {
    await this.prisma.conversation_participants.delete({
      where: { conversation_id_user_id: { conversation_id: conversationId, user_id: userId } },
    });
  }

  async listForUser(userId) {
    const rows = await this.prisma.conversations.findMany({
      where: { participants: { some: { user_id: userId } } },
      include: {
        ...PARTICIPANTS_INCLUDE,
        messages: { orderBy: { id: 'desc' }, take: 1 },
      },
    });

    const results: any[] = [];
    for (const row of rows) {
      const myParticipant = row.participants.find((p) => p.user_id === userId);
      const lastReadId = myParticipant?.last_read_message_id ?? 0;
      const unreadCount = await this.prisma.messages.count({
        where: { conversation_id: row.id, id: { gt: lastReadId }, sender_id: { not: userId } },
      });
      results.push(mapConversationRow(row, unreadCount));
    }

    results.sort((a, b) => (b.lastMessage ? b.lastMessage.id : -1) - (a.lastMessage ? a.lastMessage.id : -1));
    return results;
  }

  async markRead(conversationId, userId, messageId) {
    await this.prisma.$executeRaw`
      UPDATE conversation_participants
      SET last_read_message_id = GREATEST(COALESCE(last_read_message_id, 0), ${messageId}),
          last_read_at = now()
      WHERE conversation_id = ${conversationId} AND user_id = ${userId}
    `;
    const row = await this.prisma.conversation_participants.findUnique({
      where: { conversation_id_user_id: { conversation_id: conversationId, user_id: userId } },
      include: { users: PARTICIPANT_USER_SELECT },
    });
    return mapParticipantRow(row);
  }

  async listReachablePeople({ excludeUserId, roleNames, search }: { excludeUserId: any; roleNames: string[]; search?: string }) {
    const trimmedSearch = search && search.trim();
    const rows = await this.prisma.users.findMany({
      where: {
        id: { not: excludeUserId },
        status: 'approved',
        roles: { name: { in: roleNames } },
        ...(trimmedSearch
          ? {
              OR: [
                { firstname: { contains: trimmedSearch, mode: 'insensitive' } },
                { lastname: { contains: trimmedSearch, mode: 'insensitive' } },
                { email: { contains: trimmedSearch, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      include: { roles: { select: { name: true } } },
      orderBy: [{ firstname: 'asc' }, { lastname: 'asc' }],
    });
    return rows.map((row) => ({
      id: row.id,
      firstname: row.firstname,
      lastname: row.lastname,
      email: row.email,
      roleName: row.roles.name,
    }));
  }
}

export { PgConversationRepository };
