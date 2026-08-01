class GetReportPdfUseCase {
  reportRepository: any;
  sessionRepository: any;
  trainingRepository: any;
  clientRepository: any;
  pdfReportService: any;

  constructor({ reportRepository, sessionRepository, trainingRepository, clientRepository, pdfReportService }) {
    this.reportRepository = reportRepository;
    this.sessionRepository = sessionRepository;
    this.trainingRepository = trainingRepository;
    this.clientRepository = clientRepository;
    this.pdfReportService = pdfReportService;
  }

  async execute({ sessionId }) {
    const report = await this.reportRepository.findBySessionId(sessionId);
    if (!report) {
      throw new Error('Report not yet generated for this session');
    }

    const session = await this.sessionRepository.findById(sessionId);
    if (!session) {
      throw new Error('Training session not found');
    }

    const training = await this.trainingRepository.findById(session.trainingId);
    const client = await this.clientRepository.findById(session.clientId);

    return this.pdfReportService.generateReportPdf({ session, training, client, report });
  }
}

export { GetReportPdfUseCase };
