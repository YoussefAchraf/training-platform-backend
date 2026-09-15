import { prismaClient } from '../../src/infrastructure/database/prismaClient';
import { PgConversationRepository } from '../../src/infrastructure/repositories/PgConversationRepository';
import { PgMessageRepository } from '../../src/infrastructure/repositories/PgMessageRepository';

describe('PgMessageRepository (Prisma, real database)', () => {
  const conversationRepository = new PgConversationRepository(prismaClient);
  const repository = new PgMessageRepository(prismaClient);
  const marker = `msg-test-${Date.now()}`;
  let managerId: number;
  let instructorId: number;
  let conversationId: number;

  beforeAll(async () => {
    const managerRole = await prismaClient.roles.findFirstOrThrow({ where: { name: 'Manager' } });
    const instructorRole = await prismaClient.roles.findFirstOrThrow({ where: { name: 'Instructor' } });

    const manager = await prismaClient.users.create({
      data: { firstname: 'Mona', lastname: 'Manager', email: `${marker}-manager@example.com`, password_hash: 'x', role_id: managerRole.id, status: 'approved' },
    });
    managerId = manager.id;

    const instructor = await prismaClient.users.create({
      data: { firstname: 'Ivy', lastname: 'Instructor', email: `${marker}-instructor@example.com`, password_hash: 'x', role_id: instructorRole.id, status: 'approved' },
    });
    instructorId = instructor.id;

    const conversation = await conversationRepository.createDirect({ createdBy: managerId, participantUserIds: [managerId, instructorId] });
    conversationId = conversation.id;
  });

  afterAll(async () => {
    await prismaClient.conversations.deleteMany({ where: { id: conversationId } });
    await prismaClient.users.deleteMany({ where: { id: { in: [managerId, instructorId] } } });
    await prismaClient.$disconnect();
  });

  it('creates a text message and returns the sender name', async () => {
    const message = await repository.create({ conversationId, senderId: managerId, type: 'text', body: 'hello there' });
    expect(message.body).toBe('hello there');
    expect(message.senderName).toBe('Mona Manager');
  });

  it('links a reply to its original message', async () => {
    const original = await repository.create({ conversationId, senderId: managerId, type: 'text', body: 'original' });
    const reply = await repository.create({ conversationId, senderId: instructorId, type: 'text', body: 'reply', replyToMessageId: original.id });

    const found = await repository.findById(reply.id);
    expect(found.replyToMessageId).toBe(original.id);
  });

  it('paginates messages with a keyset cursor in ascending order', async () => {
    const ids: number[] = [];
    for (let i = 0; i < 5; i += 1) {
      const created = await repository.create({ conversationId, senderId: managerId, type: 'text', body: `msg-${i}` });
      ids.push(created.id);
    }

    const firstPage = await repository.listByConversation(conversationId, { limit: 2 });
    expect(firstPage).toHaveLength(2);
    expect(firstPage[0].id).toBeLessThan(firstPage[1].id);

    const cursor = firstPage[0].id;
    const secondPage = await repository.listByConversation(conversationId, { cursor, limit: 2 });
    expect(secondPage.every((m) => m.id < cursor)).toBe(true);
  });

  it('counts messages after a given id', async () => {
    const before = await repository.countUnread(conversationId, 0);
    await repository.create({ conversationId, senderId: managerId, type: 'text', body: 'one more' });
    const after = await repository.countUnread(conversationId, 0);
    expect(after).toBe(before + 1);
  });
});
