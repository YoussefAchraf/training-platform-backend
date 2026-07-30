class GetReportUseCase {
  reportRepository: any;

  constructor({ reportRepository }) {
    this.reportRepository = reportRepository;
  }

  async execute({ sessionId }) {
    const report = await this.reportRepository.findBySessionId(sessionId);
    if (!report) throw new Error('Report not yet generated for this session');
    return report;
  }
}

export { GetReportUseCase };
