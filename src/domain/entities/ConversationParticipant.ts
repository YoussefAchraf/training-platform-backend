class ConversationParticipant {
  conversationId: any;
  userId: any;
  role: any;
  joinedAt: any;
  lastReadMessageId: any;
  lastReadAt: any;
  lastDeliveredMessageId: any;
  lastDeliveredAt: any;
  hiddenAt: any;
  mutedAt: any;
  firstname: any;
  lastname: any;
  email: any;
  roleName: any;

  constructor({
    conversationId,
    userId,
    role,
    joinedAt,
    lastReadMessageId = null,
    lastReadAt = null,
    lastDeliveredMessageId = null,
    lastDeliveredAt = null,
    hiddenAt = null,
    mutedAt = null,
    firstname = null,
    lastname = null,
    email = null,
    roleName = null,
  }: any) {
    this.conversationId = conversationId;
    this.userId = userId;
    this.role = role;
    this.joinedAt = joinedAt;
    this.lastReadMessageId = lastReadMessageId;
    this.lastReadAt = lastReadAt;
    this.lastDeliveredMessageId = lastDeliveredMessageId;
    this.lastDeliveredAt = lastDeliveredAt;
    this.hiddenAt = hiddenAt;
    this.mutedAt = mutedAt;
    this.firstname = firstname;
    this.lastname = lastname;
    this.email = email;
    this.roleName = roleName;
  }
}

export { ConversationParticipant };
