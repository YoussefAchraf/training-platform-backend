import { Report } from '../../domain/entities/Report';
import { IReportRepository } from '../../domain/interfaces/IReportRepository';

function mapRow(row) {
  if (!row) return null;
  return new Report({
    id: row.id,
    sessionId: row.session_id,
    pdfUrl: row.pdf_url,
    averageScore: row.average_score,
    npsAverage: row.nps_average,
    generatedAt: row.generated_at,
  });
}

class PgReportRepository extends IReportRepository {
  pool: any;

  constructor(pool) {
    super();
    this.pool = pool;
  }

  async create(report) {
    const { rows } = await this.pool.query(
      `INSERT INTO reports (session_id, pdf_url, average_score, nps_average)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (session_id) DO UPDATE
         SET pdf_url = EXCLUDED.pdf_url,
             average_score = EXCLUDED.average_score,
             nps_average = EXCLUDED.nps_average,
             generated_at = now()
       RETURNING *`,
      [report.sessionId, report.pdfUrl || null, report.averageScore, report.npsAverage]
    );
    return mapRow(rows[0]);
  }

  async findBySessionId(sessionId) {
    const { rows } = await this.pool.query('SELECT * FROM reports WHERE session_id = $1', [sessionId]);
    return mapRow(rows[0]);
  }
}

export { PgReportRepository };
