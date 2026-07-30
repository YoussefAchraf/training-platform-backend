import { notImplemented } from './notImplemented';

class ICalendarRepository {
  async create(event): Promise<any> { notImplemented('ICalendarRepository', 'create'); }
  async listGlobal(): Promise<any> { notImplemented('ICalendarRepository', 'listGlobal'); }
  async listForInstructor(instructorId): Promise<any> { notImplemented('ICalendarRepository', 'listForInstructor'); }
  async update(eventId, changes): Promise<any> { notImplemented('ICalendarRepository', 'update'); }
  async delete(eventId): Promise<any> { notImplemented('ICalendarRepository', 'delete'); }
}

export { ICalendarRepository };
