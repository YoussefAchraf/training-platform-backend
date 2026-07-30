import { notImplemented } from './notImplemented';

class ITrainingRepository {
  async create(training): Promise<any> { notImplemented('ITrainingRepository', 'create'); }
  async findById(id): Promise<any> { notImplemented('ITrainingRepository', 'findById'); }
  async listAll(): Promise<any> { notImplemented('ITrainingRepository', 'listAll'); }
  async listByProvider(providerId): Promise<any> { notImplemented('ITrainingRepository', 'listByProvider'); }
}

export { ITrainingRepository };
