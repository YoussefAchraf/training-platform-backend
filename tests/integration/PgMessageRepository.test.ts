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

  it('excludes a message from a requester\'s own list once they hide it for themselves', async () => {
    const message = await repository.create({ conversationId, senderId: managerId, type: 'text', body: 'hide me' });

    const beforeHide = await repository.listByConversation(conversationId, { requesterId: instructorId, limit: 100 });
    expect(beforeHide.some((m) => m.id === message.id)).toBe(true);

    await repository.hideForUser(message.id, instructorId);

    const afterHideForInstructor = await repository.listByConversation(conversationId, { requesterId: instructorId, limit: 100 });
    expect(afterHideForInstructor.some((m) => m.id === message.id)).toBe(false);

    const afterHideForManager = await repository.listByConversation(conversationId, { requesterId: managerId, limit: 100 });
    expect(afterHideForManager.some((m) => m.id === message.id)).toBe(true);
  });

  it('redacts body and attachment fields once a message is soft-deleted for everyone', async () => {
    const message = await repository.create({
      conversationId,
      senderId: managerId,
      type: 'text',
      body: 'this will be deleted',
    });

    const deleted = await repository.softDeleteForEveryone(message.id);
    expect(deleted.deletedAt).not.toBeNull();
    expect(deleted.body).toBeNull();

    const refetched = await repository.findById(message.id);
    expect(refetched.body).toBeNull();
    expect(refetched.deletedAt).not.toBeNull();
  });

  it('filters messages by a case-insensitive search term', async () => {
    const marked = `SearchTarget-${Date.now()}`;
    await repository.create({ conversationId, senderId: managerId, type: 'text', body: `mentions ${marked} here` });
    await repository.create({ conversationId, senderId: managerId, type: 'text', body: 'unrelated content' });

    const results = await repository.listByConversation(conversationId, { search: marked.toLowerCase(), limit: 100 });
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((m) => m.body.toLowerCase().includes(marked.toLowerCase()))).toBe(true);
  });

  describe('listByConversationFiltered', () => {
    it('returns only image messages for the media filter', async () => {
      const conversation = await conversationRepository.createDirect({ createdBy: managerId, participantUserIds: [managerId, instructorId] });
      const image = await repository.create({ conversationId: conversation.id, senderId: managerId, type: 'image', attachmentKey: 'a.png', attachmentOriginalName: 'a.png' });
      await repository.create({ conversationId: conversation.id, senderId: managerId, type: 'text', body: 'not media' });

      const results = await repository.listByConversationFiltered(conversation.id, { filter: 'media', limit: 100 });
      expect(results.map((m) => m.id)).toEqual([image.id]);

      await prismaClient.conversations.delete({ where: { id: conversation.id } });
    });

    it('returns both file and voice messages for the files filter', async () => {
      const conversation = await conversationRepository.createDirect({ createdBy: managerId, participantUserIds: [managerId, instructorId] });
      const file = await repository.create({ conversationId: conversation.id, senderId: managerId, type: 'file', attachmentKey: 'a.pdf', attachmentOriginalName: 'a.pdf' });
      const voice = await repository.create({ conversationId: conversation.id, senderId: managerId, type: 'voice', attachmentKey: 'a.webm', attachmentOriginalName: 'a.webm' });
      await repository.create({ conversationId: conversation.id, senderId: managerId, type: 'image', attachmentKey: 'a.png', attachmentOriginalName: 'a.png' });

      const results = await repository.listByConversationFiltered(conversation.id, { filter: 'files', limit: 100 });
      expect(results.map((m) => m.id).sort()).toEqual([file.id, voice.id].sort());

      await prismaClient.conversations.delete({ where: { id: conversation.id } });
    });

    it('returns only text messages that contain a link for the links filter', async () => {
      const conversation = await conversationRepository.createDirect({ createdBy: managerId, participantUserIds: [managerId, instructorId] });
      const withLink = await repository.create({ conversationId: conversation.id, senderId: managerId, type: 'text', body: 'see https://example.com/page' });
      await repository.create({ conversationId: conversation.id, senderId: managerId, type: 'text', body: 'no link here' });

      const results = await repository.listByConversationFiltered(conversation.id, { filter: 'links', limit: 100 });
      expect(results.map((m) => m.id)).toEqual([withLink.id]);

      await prismaClient.conversations.delete({ where: { id: conversation.id } });
    });

    it('excludes a soft-deleted-for-everyone message from every filter', async () => {
      const conversation = await conversationRepository.createDirect({ createdBy: managerId, participantUserIds: [managerId, instructorId] });
      const image = await repository.create({ conversationId: conversation.id, senderId: managerId, type: 'image', attachmentKey: 'a.png', attachmentOriginalName: 'a.png' });
      await repository.softDeleteForEveryone(image.id);

      const results = await repository.listByConversationFiltered(conversation.id, { filter: 'media', limit: 100 });
      expect(results.some((m) => m.id === image.id)).toBe(false);

      await prismaClient.conversations.delete({ where: { id: conversation.id } });
    });
  });
});
