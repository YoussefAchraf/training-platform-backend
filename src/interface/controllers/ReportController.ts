class ReportController {
  getReportUseCase: any;
  generateReportUseCase: any;

  constructor({ getReportUseCase, generateReportUseCase }) {
    this.getReportUseCase = getReportUseCase;
    this.generateReportUseCase = generateReportUseCase;
  }

  get = async (req, res) => {
    try {
      const report = await this.getReportUseCase.execute({ sessionId: Number(req.params.sessionId) });
      res.status(200).json(report);
    } catch (err) {
      res.status(404).json({ error: err.message });
    }
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
}

export { ReportController };
