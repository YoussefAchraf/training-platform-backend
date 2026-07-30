import { notImplemented } from './notImplemented';

class IInstructorRepository {
  async create(instructor): Promise<any> { notImplemented('IInstructorRepository', 'create'); }
  async findById(id): Promise<any> { notImplemented('IInstructorRepository', 'findById'); }
  async findByUserId(userId): Promise<any> { notImplemented('IInstructorRepository', 'findByUserId'); }
  async listAll(): Promise<any> { notImplemented('IInstructorRepository', 'listAll'); }
  async updateBio(instructorId, bio): Promise<any> { notImplemented('IInstructorRepository', 'updateBio'); }
  async setSkills(instructorId, trainingIds): Promise<any> { notImplemented('IInstructorRepository', 'setSkills'); }
  async getSkills(instructorId): Promise<any> { notImplemented('IInstructorRepository', 'getSkills'); }
}

export { IInstructorRepository };
