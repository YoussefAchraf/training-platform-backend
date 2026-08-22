import { Report } from '../../domain/entities/Report';
import { IReportRepository } from '../../domain/interfaces/IReportRepository';




function toFixedNumeric(value, decimals) {
  if (value === null || value === undefined) return value;
  return Number(value.toString()).toFixed(decimals);
}

function mapRow(row) {
  if (!row) return null;
  return new Report({
    id: row.id,
    sessionId: row.session_id,
    pdfUrl: row.pdf_url,
    averageScore: toFixedNumeric(row.average_score, 2),
    npsAverage: toFixedNumeric(row.nps_average, 2),
    generatedAt: row.generated_at,
  });
}

class PgReportRepository extends IReportRepository {
  prisma: any;

  constructor(prisma) {
    super();
    this.prisma = prisma;
  }

  async create(report) {
    
    
    
    
    const row = await this.prisma.reports.upsert({
      where: { session_id: report.sessionId },
      create: {
        session_id: report.sessionId,
        pdf_url: report.pdfUrl || null,
        average_score: report.averageScore,
        nps_average: report.npsAverage,
      },
      update: {
        pdf_url: report.pdfUrl || null,
        average_score: report.averageScore,
        nps_average: report.npsAverage,
        generated_at: new Date(),
      },
    });
    return mapRow(row);
  }

  async findBySessionId(sessionId) {
    const row = await this.prisma.reports.findUnique({ where: { session_id: sessionId } });
    return mapRow(row);
  }
}

export { PgReportRepository };
