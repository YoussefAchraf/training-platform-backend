import { notImplemented } from './notImplemented';

class IFeedbackRepository {
  async create(report): Promise<any> { notImplemented('IFeedbackRepository', 'create'); }
  async listAll(): Promise<any> { notImplemented('IFeedbackRepository', 'listAll'); }
}

export { IFeedbackRepository };
