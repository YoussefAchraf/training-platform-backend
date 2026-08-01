import { notImplemented } from './notImplemented';

class IUserRepository {
  async findById(id): Promise<any> { notImplemented('IUserRepository', 'findById'); }
  async findByEmail(email): Promise<any> { notImplemented('IUserRepository', 'findByEmail'); }
  async findRoleByName(roleName): Promise<any> { notImplemented('IUserRepository', 'findRoleByName'); }
  async create(user): Promise<any> { notImplemented('IUserRepository', 'create'); }
  async approve(userId, approvedByUserId): Promise<any> { notImplemented('IUserRepository', 'approve'); }
  async listPending(): Promise<any> { notImplemented('IUserRepository', 'listPending'); }
  async listApprovedManagers(): Promise<any> { notImplemented('IUserRepository', 'listApprovedManagers'); }
  async listAll(): Promise<any> { notImplemented('IUserRepository', 'listAll'); }
  async update(userId, fields): Promise<any> { notImplemented('IUserRepository', 'update'); }
  async countActiveSuperAdmins(): Promise<any> { notImplemented('IUserRepository', 'countActiveSuperAdmins'); }
}

export { IUserRepository };
