import { notImplemented } from './notImplemented';

class IAuditLogRepository {
  async create(entry): Promise<any> { notImplemented('IAuditLogRepository', 'create'); }
  async list(filters): Promise<any> { notImplemented('IAuditLogRepository', 'list'); }
  async redactUserEntries(userId): Promise<any> { notImplemented('IAuditLogRepository', 'redactUserEntries'); }
}

export { IAuditLogRepository };
