import { notImplemented } from './notImplemented';

class ITrainingRepository {
  async create(training): Promise<any> { notImplemented('ITrainingRepository', 'create'); }
  async findById(id): Promise<any> { notImplemented('ITrainingRepository', 'findById'); }
  async listAll(): Promise<any> { notImplemented('ITrainingRepository', 'listAll'); }
  async listByProvider(providerId): Promise<any> { notImplemented('ITrainingRepository', 'listByProvider'); }
  async update(id, fields): Promise<any> { notImplemented('ITrainingRepository', 'update'); }
  async softDelete(id): Promise<any> { notImplemented('ITrainingRepository', 'softDelete'); }
}

export { ITrainingRepository };
