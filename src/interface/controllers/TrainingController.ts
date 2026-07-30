class TrainingController {
  createTrainingUseCase: any;
  listTrainingsUseCase: any;

  constructor({ createTrainingUseCase, listTrainingsUseCase }) {
    this.createTrainingUseCase = createTrainingUseCase;
    this.listTrainingsUseCase = listTrainingsUseCase;
  }

  create = async (req, res) => {
    try {
      const { name, providerId, description, duration } = req.body;
      const training = await this.createTrainingUseCase.execute({
        requester: req.user,
        name,
        providerId,
        description,
        duration,
      });
      res.status(201).json(training);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  };

  list = async (req, res) => {
    try {
      const providerId = req.query.providerId ? Number(req.query.providerId) : undefined;
      const trainings = await this.listTrainingsUseCase.execute({ providerId });
      res.status(200).json(trainings);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  };
}

export { TrainingController };
