import { notImplemented } from './notImplemented';

class IReportRepository {
  async create(report): Promise<any> { notImplemented('IReportRepository', 'create'); }
  async findBySessionId(sessionId): Promise<any> { notImplemented('IReportRepository', 'findBySessionId'); }
}

export { IReportRepository };
