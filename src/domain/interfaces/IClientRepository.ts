import { notImplemented } from './notImplemented';

class IClientRepository {
  async create(client): Promise<any> { notImplemented('IClientRepository', 'create'); }
  async findById(id): Promise<any> { notImplemented('IClientRepository', 'findById'); }
  async listAll(): Promise<any> { notImplemented('IClientRepository', 'listAll'); }
}

export { IClientRepository };
