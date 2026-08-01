import { notImplemented } from './notImplemented';

class IClientRepository {
  async create(client): Promise<any> { notImplemented('IClientRepository', 'create'); }
  async findById(id): Promise<any> { notImplemented('IClientRepository', 'findById'); }
  async listAll(): Promise<any> { notImplemented('IClientRepository', 'listAll'); }
  async update(id, fields): Promise<any> { notImplemented('IClientRepository', 'update'); }
  async softDelete(id): Promise<any> { notImplemented('IClientRepository', 'softDelete'); }
}

export { IClientRepository };
