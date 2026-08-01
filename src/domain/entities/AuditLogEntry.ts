class AuditLogEntry {
  id: any;
  actorId: any;
  action: any;
  entityType: any;
  entityId: any;
  before: any;
  after: any;
  createdAt: any;

  constructor({ id, actorId, action, entityType, entityId, before, after, createdAt }: any) {
    this.id = id;
    this.actorId = actorId;
    this.action = action;
    this.entityType = entityType;
    this.entityId = entityId;
    this.before = before;
    this.after = after;
    this.createdAt = createdAt;
  }
}

export { AuditLogEntry };
