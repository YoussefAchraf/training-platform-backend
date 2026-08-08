class SessionController {
  createSessionUseCase: any;
  listSessionsUseCase: any;
  assignInstructorUseCase: any;
  respondToAssignmentUseCase: any;
  addAttendeeUseCase: any;
  listSessionAttendeesUseCase: any;
  updateSessionUseCase: any;
  cancelSessionUseCase: any;

  constructor({
    createSessionUseCase,
    listSessionsUseCase,
    assignInstructorUseCase,
    respondToAssignmentUseCase,
    addAttendeeUseCase,
    listSessionAttendeesUseCase,
    updateSessionUseCase,
    cancelSessionUseCase,
  }) {
    this.createSessionUseCase = createSessionUseCase;
    this.listSessionsUseCase = listSessionsUseCase;
    this.assignInstructorUseCase = assignInstructorUseCase;
    this.respondToAssignmentUseCase = respondToAssignmentUseCase;
    this.addAttendeeUseCase = addAttendeeUseCase;
    this.listSessionAttendeesUseCase = listSessionAttendeesUseCase;
    this.updateSessionUseCase = updateSessionUseCase;
    this.cancelSessionUseCase = cancelSessionUseCase;
  }

  create = async (req, res) => {
    try {
      const { trainingId, clientId, startDate, endDate } = req.body;
      const session = await this.createSessionUseCase.execute({
        requester: req.user,
        trainingId,
        clientId,
        startDate,
        endDate,
      });
      res.status(201).json(session);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  };

  list = async (req, res) => {
    try {
      const sessions = await this.listSessionsUseCase.execute({ requester: req.user });
      res.status(200).json(sessions);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  };

  assignInstructor = async (req, res) => {
    try {
      const { instructorId } = req.body;
      const session = await this.assignInstructorUseCase.execute({
        requester: req.user,
        sessionId: Number(req.params.id),
        instructorId,
      });
      res.status(200).json(session);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  };

  respond = async (req, res) => {
    try {
      const { decision } = req.body; 
      const session = await this.respondToAssignmentUseCase.execute({
        requester: req.user,
        sessionId: Number(req.params.id),
        decision,
      });
      res.status(200).json(session);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  };

  addAttendee = async (req, res) => {
    try {
      const { name, email } = req.body;
      const attendee = await this.addAttendeeUseCase.execute({
        requester: req.user,
        sessionId: Number(req.params.id),
        name,
        email,
      });
      res.status(201).json(attendee);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  };

  listAttendees = async (req, res) => {
    try {
      const attendees = await this.listSessionAttendeesUseCase.execute({
        requester: req.user,
        sessionId: Number(req.params.id),
      });
      res.status(200).json(attendees);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  };

  update = async (req, res) => {
    try {
      const { startDate, endDate } = req.body;
      const session = await this.updateSessionUseCase.execute({
        requester: req.user,
        sessionId: Number(req.params.id),
        startDate,
        endDate,
      });
      res.status(200).json(session);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  };

  cancel = async (req, res) => {
    try {
      const session = await this.cancelSessionUseCase.execute({
        requester: req.user,
        sessionId: Number(req.params.id),
      });
      res.status(200).json(session);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  };
}

export { SessionController };
