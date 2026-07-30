class InstructorController {
  listInstructorsUseCase: any;
  getMyInstructorProfileUseCase: any;
  updateMyInstructorProfileUseCase: any;
  updateInstructorByManagerUseCase: any;

  constructor({
    listInstructorsUseCase,
    getMyInstructorProfileUseCase,
    updateMyInstructorProfileUseCase,
    updateInstructorByManagerUseCase,
  }) {
    this.listInstructorsUseCase = listInstructorsUseCase;
    this.getMyInstructorProfileUseCase = getMyInstructorProfileUseCase;
    this.updateMyInstructorProfileUseCase = updateMyInstructorProfileUseCase;
    this.updateInstructorByManagerUseCase = updateInstructorByManagerUseCase;
  }

  list = async (req, res) => {
    try {
      const instructors = await this.listInstructorsUseCase.execute();
      res.status(200).json(instructors);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  };

  getMe = async (req, res) => {
    try {
      const profile = await this.getMyInstructorProfileUseCase.execute({ requester: req.user });
      res.status(200).json(profile);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  };

  updateMe = async (req, res) => {
    try {
      const { bio, trainingIds } = req.body;
      const profile = await this.updateMyInstructorProfileUseCase.execute({
        requester: req.user,
        bio,
        trainingIds,
      });
      res.status(200).json(profile);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  };

  updateByManager = async (req, res) => {
    try {
      const { bio, trainingIds } = req.body;
      const profile = await this.updateInstructorByManagerUseCase.execute({
        requester: req.user,
        instructorId: Number(req.params.id),
        bio,
        trainingIds,
      });
      res.status(200).json(profile);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  };
}

export { InstructorController };
