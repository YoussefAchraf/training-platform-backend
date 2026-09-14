import { SessionNote } from '../../domain/entities/SessionNote';
import { ISessionNoteRepository } from '../../domain/interfaces/ISessionNoteRepository';

function mapRow(row) {
  if (!row) return null;
  return new SessionNote({
    id: row.id,
    sessionId: row.session_id,
    instructorId: row.instructor_id,
    body: row.body,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

class PgSessionNoteRepository extends ISessionNoteRepository {
  prisma: any;

  constructor(prisma) {
    super();
    this.prisma = prisma;
  }

  async create({ sessionId, instructorId, body }) {
    const row = await this.prisma.session_notes.create({
      data: {
        session_id: sessionId,
        instructor_id: instructorId,
        body,
      },
    });
    return mapRow(row);
  }

  async findById(id) {
    const row = await this.prisma.session_notes.findUnique({ where: { id } });
    return mapRow(row);
  }

  async listBySessionId(sessionId) {
    const rows = await this.prisma.session_notes.findMany({
      where: { session_id: sessionId },
      orderBy: { created_at: 'desc' },
    });
    return rows.map(mapRow);
  }

  async update(id, body) {
    const row = await this.prisma.session_notes.update({
      where: { id },
      data: { body, updated_at: new Date() },
    });
    return mapRow(row);
  }

  async delete(id) {
    await this.prisma.session_notes.delete({ where: { id } });
  }
}

export { PgSessionNoteRepository };
