class Message {
  id: any;
  conversationId: any;
  senderId: any;
  senderName: any;
  type: any;
  body: any;
  attachmentKey: any;
  attachmentOriginalName: any;
  attachmentMime: any;
  attachmentSizeBytes: any;
  attachmentDurationSeconds: any;
  replyToMessageId: any;
  createdAt: any;
  editedAt: any;
  deletedAt: any;

  constructor({
    id,
    conversationId,
    senderId,
    senderName = null,
    type,
    body = null,
    attachmentKey = null,
    attachmentOriginalName = null,
    attachmentMime = null,
    attachmentSizeBytes = null,
    attachmentDurationSeconds = null,
    replyToMessageId = null,
    createdAt,
    editedAt = null,
    deletedAt = null,
  }: any) {
    this.id = id;
    this.conversationId = conversationId;
    this.senderId = senderId;
    this.senderName = senderName;
    this.type = type;
    this.body = body;
    this.attachmentKey = attachmentKey;
    this.attachmentOriginalName = attachmentOriginalName;
    this.attachmentMime = attachmentMime;
    this.attachmentSizeBytes = attachmentSizeBytes;
    this.attachmentDurationSeconds = attachmentDurationSeconds;
    this.replyToMessageId = replyToMessageId;
    this.createdAt = createdAt;
    this.editedAt = editedAt;
    this.deletedAt = deletedAt;
  }
}

export { Message };
