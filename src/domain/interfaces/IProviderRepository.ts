import { notImplemented } from './notImplemented';

class IProviderRepository {
  async create(provider): Promise<any> { notImplemented('IProviderRepository', 'create'); }
  async findById(id): Promise<any> { notImplemented('IProviderRepository', 'findById'); }
  async findByName(name): Promise<any> { notImplemented('IProviderRepository', 'findByName'); }
  async listAll(): Promise<any> { notImplemented('IProviderRepository', 'listAll'); }
  async update(id, fields): Promise<any> { notImplemented('IProviderRepository', 'update'); }
  async softDelete(id): Promise<any> { notImplemented('IProviderRepository', 'softDelete'); }
}

export { IProviderRepository };
