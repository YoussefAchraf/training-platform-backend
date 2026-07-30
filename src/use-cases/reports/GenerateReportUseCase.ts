class GenerateReportUseCase {
  sessionRepository: any;
  surveyRepository: any;
  reportRepository: any;

  constructor({ sessionRepository, surveyRepository, reportRepository }) {
    this.sessionRepository = sessionRepository;
    this.surveyRepository = surveyRepository;
    this.reportRepository = reportRepository;
  }

    async execute({ requester, sessionId, triggeredBy = 'manual' }) {
    if (requester && !(requester.isManager() || requester.canManageCatalog())) {
      throw new Error('Only Sales or Manager can manually trigger report generation');
    }

    const session = await this.sessionRepository.findById(sessionId);
    if (!session) throw new Error('Training session not found');
    console.log(`[GenerateReportUseCase] session ${sessionId} report triggered by: ${triggeredBy}`);

    const { average_score, nps_average } = await this.surveyRepository.getSessionAverages(sessionId);

    const report = await this.reportRepository.create({
      sessionId,
      pdfUrl: null, 
      averageScore: average_score,
      npsAverage: nps_average,
    });

    
    await this.sessionRepository.updateSessionStatus(sessionId, 'completed');

    return report;
  }
}

export { GenerateReportUseCase };
