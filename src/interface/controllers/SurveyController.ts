class SurveyController {
  generateSurveyQRUseCase: any;
  getSurveySessionInfoUseCase: any;
  submitSurveyUseCase: any;

  constructor({ generateSurveyQRUseCase, getSurveySessionInfoUseCase, submitSurveyUseCase }) {
    this.generateSurveyQRUseCase = generateSurveyQRUseCase;
    this.getSurveySessionInfoUseCase = getSurveySessionInfoUseCase;
    this.submitSurveyUseCase = submitSurveyUseCase;
  }

  generateQR = async (req, res) => {
    try {
      const result = await this.generateSurveyQRUseCase.execute({
        requester: req.user,
        sessionId: Number(req.params.sessionId),
      });
      res.status(200).json(result);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  };

  
  getSurveyInfo = async (req, res) => {
    try {
      const info = await this.getSurveySessionInfoUseCase.execute({
        sessionId: Number(req.params.sessionId),
      });
      res.status(200).json(info);
    } catch (err) {
      res.status(404).json({ error: err.message });
    }
  };

  
  submit = async (req, res) => {
    try {
      const { attendeeId, instructorScore, npsScore, comments } = req.body;
      const survey = await this.submitSurveyUseCase.execute({
        sessionId: Number(req.params.sessionId),
        attendeeId,
        instructorScore,
        npsScore,
        comments,
      });
      res.status(201).json(survey);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  };
}

export { SurveyController };
