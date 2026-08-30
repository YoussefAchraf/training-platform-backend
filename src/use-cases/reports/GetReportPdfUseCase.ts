class GetReportPdfUseCase {
  reportRepository: any;
  sessionRepository: any;
  trainingRepository: any;
  clientRepository: any;
  instructorRepository: any;
  pdfReportService: any;

  constructor({ reportRepository, sessionRepository, trainingRepository, clientRepository, instructorRepository, pdfReportService }) {
    this.reportRepository = reportRepository;
    this.sessionRepository = sessionRepository;
    this.trainingRepository = trainingRepository;
    this.clientRepository = clientRepository;
    this.instructorRepository = instructorRepository;
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
    const instructor = session.instructorId ? await this.instructorRepository.findById(session.instructorId) : null;
    const attendees = await this.sessionRepository.listAttendees(sessionId);

    return this.pdfReportService.generateReportPdf({ session, training, client, instructor, attendees, report });
  }
}

export { GetReportPdfUseCase };
