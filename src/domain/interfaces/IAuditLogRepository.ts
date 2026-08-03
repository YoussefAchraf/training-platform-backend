import { notImplemented } from './notImplemented';

class IAuditLogRepository {
  async create(entry): Promise<any> { notImplemented('IAuditLogRepository', 'create'); }
  async list(filters): Promise<any> { notImplemented('IAuditLogRepository', 'list'); }
}

export { IAuditLogRepository };
