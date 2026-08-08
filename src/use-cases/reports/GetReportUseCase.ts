class GetReportUseCase {
  reportRepository: any;

  constructor({ reportRepository }) {
    this.reportRepository = reportRepository;
  }

  
  
  
  async execute({ sessionId }) {
    return this.reportRepository.findBySessionId(sessionId);
  }
}

export { GetReportUseCase };
