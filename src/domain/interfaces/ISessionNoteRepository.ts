import { notImplemented } from './notImplemented';

class ISessionNoteRepository {
  async create(note): Promise<any> { notImplemented('ISessionNoteRepository', 'create'); }
  async findById(id): Promise<any> { notImplemented('ISessionNoteRepository', 'findById'); }
  async listBySessionId(sessionId): Promise<any> { notImplemented('ISessionNoteRepository', 'listBySessionId'); }
  async update(id, body): Promise<any> { notImplemented('ISessionNoteRepository', 'update'); }
  async delete(id): Promise<any> { notImplemented('ISessionNoteRepository', 'delete'); }
}

export { ISessionNoteRepository };
