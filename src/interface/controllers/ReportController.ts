class ReportController {
  getReportUseCase: any;
  generateReportUseCase: any;
  getReportPdfUseCase: any;

  constructor({ getReportUseCase, generateReportUseCase, getReportPdfUseCase }) {
    this.getReportUseCase = getReportUseCase;
    this.generateReportUseCase = generateReportUseCase;
    this.getReportPdfUseCase = getReportPdfUseCase;
  }

  
  
  
  
  
  get = async (req, res) => {
    const report = await this.getReportUseCase.execute({ sessionId: Number(req.params.sessionId) });
    res.status(200).json(report);
  };

  generate = async (req, res) => {
    try {
      const report = await this.generateReportUseCase.execute({
        requester: req.user,
        sessionId: Number(req.params.sessionId),
        triggeredBy: 'manual',
      });
      res.status(201).json(report);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  };

  downloadPdf = async (req, res) => {
    try {
      const sessionId = Number(req.params.sessionId);
      const pdfBuffer = await this.getReportPdfUseCase.execute({ sessionId });
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="report-${sessionId}.pdf"`);
      res.send(pdfBuffer);
    } catch (err) {
      res.status(404).json({ error: err.message });
    }
  };
}

export { ReportController };
