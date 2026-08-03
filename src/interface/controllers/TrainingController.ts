class TrainingController {
  createTrainingUseCase: any;
  listTrainingsUseCase: any;
  updateTrainingUseCase: any;
  deleteTrainingUseCase: any;

  constructor({ createTrainingUseCase, listTrainingsUseCase, updateTrainingUseCase, deleteTrainingUseCase }) {
    this.createTrainingUseCase = createTrainingUseCase;
    this.listTrainingsUseCase = listTrainingsUseCase;
    this.updateTrainingUseCase = updateTrainingUseCase;
    this.deleteTrainingUseCase = deleteTrainingUseCase;
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

  update = async (req, res) => {
    try {
      const { name, description, duration } = req.body;
      const training = await this.updateTrainingUseCase.execute({
        requester: req.user,
        trainingId: Number(req.params.id),
        name,
        description,
        duration,
      });
      res.status(200).json(training);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  };

  remove = async (req, res) => {
    try {
      await this.deleteTrainingUseCase.execute({ requester: req.user, trainingId: Number(req.params.id) });
      res.status(204).send();
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  };
}

export { TrainingController };
