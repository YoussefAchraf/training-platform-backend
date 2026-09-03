class AuditLogEntry {
  id: any;
  actorId: any;
  actorName: any;
  actorDeleted: any;
  action: any;
  entityType: any;
  entityId: any;
  before: any;
  after: any;
  createdAt: any;

  constructor({ id, actorId, actorName, actorDeleted = false, action, entityType, entityId, before, after, createdAt }: any) {
    this.id = id;
    this.actorId = actorId;
    this.actorName = actorName;
    this.actorDeleted = actorDeleted;
    this.action = action;
    this.entityType = entityType;
    this.entityId = entityId;
    this.before = before;
    this.after = after;
    this.createdAt = createdAt;
  }
}

export { AuditLogEntry };
