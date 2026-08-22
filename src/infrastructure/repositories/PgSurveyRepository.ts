import { Survey } from '../../domain/entities/Survey';
import { ISurveyRepository } from '../../domain/interfaces/ISurveyRepository';

function mapRow(row) {
  if (!row) return null;
  return new Survey({
    id: row.id,
    sessionId: row.session_id,
    instructorId: row.instructor_id,
    attendeeId: row.attendee_id,
    instructorScore: row.instructor_score,
    npsScore: row.nps_score,
    comments: row.comments,
    submittedAt: row.submitted_at,
  });
}







function toFixedNumeric(value, decimals) {
  if (value === null || value === undefined) return value;
  return Number(value.toString()).toFixed(decimals);
}

class PgSurveyRepository extends ISurveyRepository {
  prisma: any;

  constructor(prisma) {
    super();
    this.prisma = prisma;
  }

  async create(survey) {
    const row = await this.prisma.surveys.create({
      data: {
        session_id: survey.sessionId,
        instructor_id: survey.instructorId,
        attendee_id: survey.attendeeId || null,
        instructor_score: survey.instructorScore,
        nps_score: survey.npsScore,
        comments: survey.comments || null,
      },
    });
    return mapRow(row);
  }

  async listBySession(sessionId) {
    const rows = await this.prisma.surveys.findMany({
      where: { session_id: sessionId },
      orderBy: { submitted_at: 'asc' },
    });
    return rows.map(mapRow);
  }

  async getSessionAverages(sessionId) {
    
    
    
    
    
    
    const rows = await this.prisma.$queryRaw<
      { average_score: unknown; nps_average: unknown; total_responses: unknown }[]
    >`
      SELECT
        COALESCE(AVG(instructor_score), 0)::numeric(4,2) AS average_score,
        COALESCE(AVG(
          CASE
            WHEN nps_score <= 6 THEN -1
            WHEN nps_score <= 8 THEN 0
            ELSE 1
          END
        ) * 100, 0)::numeric(5,2) AS nps_average,
        COUNT(*)::int AS total_responses
      FROM surveys WHERE session_id = ${sessionId}
    `;
    const row = rows[0];
    return {
      average_score: toFixedNumeric(row.average_score, 2),
      nps_average: toFixedNumeric(row.nps_average, 2),
      total_responses: Number(row.total_responses),
    };
  }
}

export { PgSurveyRepository };
