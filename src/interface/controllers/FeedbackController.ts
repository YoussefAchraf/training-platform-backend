class FeedbackController {
  submitFeedbackReportUseCase: any;
  listFeedbackReportsUseCase: any;

  constructor({ submitFeedbackReportUseCase, listFeedbackReportsUseCase }) {
    this.submitFeedbackReportUseCase = submitFeedbackReportUseCase;
    this.listFeedbackReportsUseCase = listFeedbackReportsUseCase;
  }

  submit = async (req, res) => {
    try {
      const { category, message } = req.body;
      const report = await this.submitFeedbackReportUseCase.execute({ requester: req.user, category, message });
      res.status(201).json(report);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  };

  list = async (req, res) => {
    try {
      const reports = await this.listFeedbackReportsUseCase.execute({ requester: req.user });
      res.status(200).json(reports);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  };
}

export { FeedbackController };
