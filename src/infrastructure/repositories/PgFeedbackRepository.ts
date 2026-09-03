import { FeedbackReport } from '../../domain/entities/FeedbackReport';
import { IFeedbackRepository } from '../../domain/interfaces/IFeedbackRepository';

function mapRow(row) {
  if (!row) return null;
  return new FeedbackReport({
    id: row.id,
    submittedBy: row.submitted_by,
    submitterName: row.users ? `${row.users.firstname} ${row.users.lastname}` : null,
    submitterEmail: row.users ? row.users.email : null,
    submitterRole: row.users?.roles ? row.users.roles.name : null,
    category: row.category,
    message: row.message,
    createdAt: row.created_at,
  });
}

class PgFeedbackRepository extends IFeedbackRepository {
  prisma: any;

  constructor(prisma) {
    super();
    this.prisma = prisma;
  }

  async create({ submittedBy, category, message }) {
    const row = await this.prisma.feedback_reports.create({
      data: { submitted_by: submittedBy, category, message },
      include: { users: { include: { roles: true } } },
    });
    return mapRow(row);
  }

  async listAll() {
    const rows = await this.prisma.feedback_reports.findMany({
      include: { users: { include: { roles: true } } },
      orderBy: { created_at: 'desc' },
    });
    return rows.map(mapRow);
  }
}

export { PgFeedbackRepository };
