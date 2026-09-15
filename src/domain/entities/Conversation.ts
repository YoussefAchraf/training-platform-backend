class Conversation {
  id: any;
  type: any;
  name: any;
  createdBy: any;
  createdAt: any;
  participants: any;
  lastMessage: any;
  unreadCount: any;

  constructor({ id, type, name, createdBy, createdAt, participants = [], lastMessage = null, unreadCount = 0 }: any) {
    this.id = id;
    this.type = type;
    this.name = name;
    this.createdBy = createdBy;
    this.createdAt = createdAt;
    this.participants = participants;
    this.lastMessage = lastMessage;
    this.unreadCount = unreadCount;
  }
}

export { Conversation };
