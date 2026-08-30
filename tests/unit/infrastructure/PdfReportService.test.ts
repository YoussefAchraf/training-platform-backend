import { PdfReportService } from '../../../src/infrastructure/services/PdfReportService';

function buildFixture(overrides: Record<string, any> = {}) {
  return {
    session: {
      id: 5,
      startDate: '2026-09-01T09:00:00Z',
      endDate: '2026-09-03T17:00:00Z',
      sessionStatus: 'completed',
    },
    training: { id: 1, name: 'RHCSA', providerName: 'Red Hat' },
    client: { id: 2, companyName: 'Acme Corp' },
    instructor: { id: 3, firstname: 'Jane', lastname: 'Doe' },
    attendees: [
      { id: 1, name: 'Alice', email: 'alice@example.com', attendanceStatus: 'present', surveySubmitted: true },
      { id: 2, name: 'Bob', email: 'bob@example.com', attendanceStatus: 'absent', surveySubmitted: false },
    ],
    report: { averageScore: '4.20', npsAverage: '80.00', generatedAt: new Date().toISOString() },
    ...overrides,
  };
}

describe('PdfReportService', () => {
  it('resolves a non-empty PDF buffer for a representative session', async () => {
    const service = new PdfReportService();
    const buffer = await service.generateReportPdf(buildFixture());

    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.length).toBeGreaterThan(0);
    
    expect(buffer.subarray(0, 5).toString()).toBe('%PDF-');
  });

  it('handles a session with no instructor assigned and no attendees', async () => {
    const service = new PdfReportService();
    const buffer = await service.generateReportPdf(buildFixture({ instructor: null, attendees: [] }));

    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.length).toBeGreaterThan(0);
  });

  it('handles a report with no scores yet (N/A)', async () => {
    const service = new PdfReportService();
    const buffer = await service.generateReportPdf(
      buildFixture({ report: { averageScore: null, npsAverage: null, generatedAt: new Date().toISOString() } }),
    );

    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.length).toBeGreaterThan(0);
  });

  it('produces multiple pages when the attendee list is long enough to overflow one page', async () => {
    const manyAttendees = Array.from({ length: 60 }, (_, i) => ({
      id: i + 1,
      name: `Attendee ${i + 1}`,
      email: `attendee${i + 1}@example.com`,
      attendanceStatus: i % 2 === 0 ? 'present' : 'absent',
      surveySubmitted: i % 3 === 0,
    }));
    const service = new PdfReportService();
    const buffer = await service.generateReportPdf(buildFixture({ attendees: manyAttendees }));

    expect(Buffer.isBuffer(buffer)).toBe(true);
    
    const pdfText = buffer.toString('latin1');
    const pageCount = (pdfText.match(/\/Type\s*\/Page[^s]/g) || []).length;
    expect(pageCount).toBeGreaterThan(1);
  });
});
