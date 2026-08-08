class AuditLogEntry {
  id: any;
  actorId: any;
  actorName: any;
  action: any;
  entityType: any;
  entityId: any;
  before: any;
  after: any;
  createdAt: any;

  constructor({ id, actorId, actorName, action, entityType, entityId, before, after, createdAt }: any) {
    this.id = id;
    this.actorId = actorId;
    this.actorName = actorName;
    this.action = action;
    this.entityType = entityType;
    this.entityId = entityId;
    this.before = before;
    this.after = after;
    this.createdAt = createdAt;
  }
}

export { AuditLogEntry };
