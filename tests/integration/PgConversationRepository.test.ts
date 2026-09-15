import { prismaClient } from '../../src/infrastructure/database/prismaClient';
import { PgConversationRepository } from '../../src/infrastructure/repositories/PgConversationRepository';

describe('PgConversationRepository (Prisma, real database)', () => {
  const repository = new PgConversationRepository(prismaClient);
  const marker = `conv-test-${Date.now()}`;
  let managerId: number;
  let instructorId: number;
  let otherInstructorId: number;
  const createdConversationIds: number[] = [];

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

    const otherInstructor = await prismaClient.users.create({
      data: { firstname: 'Owen', lastname: 'Other', email: `${marker}-other@example.com`, password_hash: 'x', role_id: instructorRole.id, status: 'approved' },
    });
    otherInstructorId = otherInstructor.id;
  });

  afterAll(async () => {
    await prismaClient.conversations.deleteMany({ where: { id: { in: createdConversationIds } } });
    await prismaClient.users.deleteMany({ where: { id: { in: [managerId, instructorId, otherInstructorId] } } });
    await prismaClient.$disconnect();
  });

  it('creates a direct conversation with both participants', async () => {
    const conversation = await repository.createDirect({ createdBy: managerId, participantUserIds: [managerId, instructorId] });
    createdConversationIds.push(conversation.id);

    expect(conversation.type).toBe('direct');
    expect(conversation.participants).toHaveLength(2);
    expect(conversation.participants.map((p) => p.userId).sort()).toEqual([managerId, instructorId].sort());
  });

  it('finds the existing direct conversation between the same two users instead of creating a duplicate', async () => {
    const found = await repository.findDirectConversationBetween(managerId, instructorId);
    expect(found).not.toBeNull();
    expect(found.participants).toHaveLength(2);
  });

  it('returns null for two users with no direct conversation', async () => {
    const found = await repository.findDirectConversationBetween(managerId, otherInstructorId);
    expect(found).toBeNull();
  });

  it('creates a group conversation with an owner and members', async () => {
    const group = await repository.createGroup({ createdBy: managerId, name: 'Onboarding', memberUserIds: [instructorId, otherInstructorId] });
    createdConversationIds.push(group.id);

    expect(group.type).toBe('group');
    expect(group.name).toBe('Onboarding');
    const owner = group.participants.find((p) => p.userId === managerId);
    expect(owner.role).toBe('owner');
    expect(group.participants).toHaveLength(3);
  });

  it('reports participant membership correctly', async () => {
    const group = await repository.createGroup({ createdBy: managerId, name: 'Temp', memberUserIds: [instructorId] });
    createdConversationIds.push(group.id);

    expect(await repository.isParticipant(group.id, managerId)).toBe(true);
    expect(await repository.isParticipant(group.id, otherInstructorId)).toBe(false);
  });

  it('adds and removes a participant', async () => {
    const group = await repository.createGroup({ createdBy: managerId, name: 'Add/Remove', memberUserIds: [instructorId] });
    createdConversationIds.push(group.id);

    await repository.addParticipant(group.id, otherInstructorId, 'member');
    expect(await repository.isParticipant(group.id, otherInstructorId)).toBe(true);

    await repository.removeParticipant(group.id, otherInstructorId);
    expect(await repository.isParticipant(group.id, otherInstructorId)).toBe(false);
  });

  it('lists reachable people excluding the requester and roles outside the allow-list', async () => {
    const results = await repository.listReachablePeople({ excludeUserId: managerId, roleNames: ['Manager', 'Instructor'] });
    const ids = results.map((r) => r.id);
    expect(ids).not.toContain(managerId);
    expect(ids).toContain(instructorId);
  });

  it('filters the directory by search term', async () => {
    const results = await repository.listReachablePeople({ excludeUserId: managerId, roleNames: ['Manager', 'Instructor'], search: 'Owen' });
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe(otherInstructorId);
  });

  describe('markRead', () => {
    it('only ever moves forward, never backward, even under out-of-order calls (the concurrency-safety ratchet)', async () => {
      const conversation = await repository.createDirect({ createdBy: managerId, participantUserIds: [managerId, instructorId] });
      createdConversationIds.push(conversation.id);

      const messageA = await prismaClient.messages.create({ data: { conversation_id: conversation.id, sender_id: instructorId, type: 'text', body: 'first' } });
      const messageB = await prismaClient.messages.create({ data: { conversation_id: conversation.id, sender_id: instructorId, type: 'text', body: 'second' } });

      await repository.markRead(conversation.id, managerId, messageB.id);
      const afterHigh = await prismaClient.conversation_participants.findUnique({
        where: { conversation_id_user_id: { conversation_id: conversation.id, user_id: managerId } },
      });
      expect(afterHigh.last_read_message_id).toBe(messageB.id);

      await repository.markRead(conversation.id, managerId, messageA.id);
      const afterLow = await prismaClient.conversation_participants.findUnique({
        where: { conversation_id_user_id: { conversation_id: conversation.id, user_id: managerId } },
      });
      expect(afterLow.last_read_message_id).toBe(messageB.id);
    });
  });

  describe('markDelivered', () => {
    it('only ever moves forward, never backward, even under out-of-order calls (the concurrency-safety ratchet)', async () => {
      const conversation = await repository.createDirect({ createdBy: managerId, participantUserIds: [managerId, instructorId] });
      createdConversationIds.push(conversation.id);

      const messageA = await prismaClient.messages.create({ data: { conversation_id: conversation.id, sender_id: instructorId, type: 'text', body: 'first' } });
      const messageB = await prismaClient.messages.create({ data: { conversation_id: conversation.id, sender_id: instructorId, type: 'text', body: 'second' } });

      const afterHighResult = await repository.markDelivered(conversation.id, managerId, messageB.id);
      expect(afterHighResult.lastDeliveredMessageId).toBe(messageB.id);

      const afterLowResult = await repository.markDelivered(conversation.id, managerId, messageA.id);
      expect(afterLowResult.lastDeliveredMessageId).toBe(messageB.id);
    });
  });

  describe('listForUser', () => {
    it('computes an unread count that excludes the reader\'s own messages', async () => {
      const conversation = await repository.createDirect({ createdBy: managerId, participantUserIds: [managerId, instructorId] });
      createdConversationIds.push(conversation.id);

      await prismaClient.messages.create({ data: { conversation_id: conversation.id, sender_id: managerId, type: 'text', body: 'from manager' } });
      await prismaClient.messages.create({ data: { conversation_id: conversation.id, sender_id: instructorId, type: 'text', body: 'from instructor' } });

      const conversations = await repository.listForUser(managerId);
      const found = conversations.find((c) => c.id === conversation.id);
      expect(found.unreadCount).toBe(1);
      expect(found.lastMessage.body).toBe('from instructor');
    });

    it('never leaks a soft-deleted-for-everyone message\'s body into the last-message preview', async () => {
      const conversation = await repository.createDirect({ createdBy: managerId, participantUserIds: [managerId, instructorId] });
      createdConversationIds.push(conversation.id);

      const message = await prismaClient.messages.create({
        data: { conversation_id: conversation.id, sender_id: managerId, type: 'text', body: 'secret content' },
      });
      await prismaClient.messages.update({ where: { id: message.id }, data: { deleted_at: new Date() } });

      const conversations = await repository.listForUser(instructorId);
      const found = conversations.find((c) => c.id === conversation.id);
      expect(found.lastMessage.id).toBe(message.id);
      expect(found.lastMessage.body).toBeNull();
      expect(found.lastMessage.deletedAt).not.toBeNull();
    });

    it('skips a message the requester hid for themselves when computing their own last-message preview', async () => {
      const conversation = await repository.createDirect({ createdBy: managerId, participantUserIds: [managerId, instructorId] });
      createdConversationIds.push(conversation.id);

      const earlier = await prismaClient.messages.create({
        data: { conversation_id: conversation.id, sender_id: managerId, type: 'text', body: 'earlier message' },
      });
      const latest = await prismaClient.messages.create({
        data: { conversation_id: conversation.id, sender_id: managerId, type: 'text', body: 'latest message' },
      });
      await prismaClient.message_deletions.create({ data: { message_id: latest.id, user_id: instructorId } });

      const forInstructor = await repository.listForUser(instructorId);
      expect(forInstructor.find((c) => c.id === conversation.id).lastMessage.id).toBe(earlier.id);

      const forManager = await repository.listForUser(managerId);
      expect(forManager.find((c) => c.id === conversation.id).lastMessage.id).toBe(latest.id);
    });
  });
});
