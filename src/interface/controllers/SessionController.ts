class SessionController {
  createSessionUseCase: any;
  listSessionsUseCase: any;
  assignInstructorUseCase: any;
  addAttendeeUseCase: any;
  listSessionAttendeesUseCase: any;
  updateSessionUseCase: any;
  cancelSessionUseCase: any;
  bulkImportAttendeesUseCase: any;
  markAttendanceUseCase: any;
  updateAttendeeUseCase: any;
  deleteAttendeeUseCase: any;

  constructor({
    createSessionUseCase,
    listSessionsUseCase,
    assignInstructorUseCase,
    addAttendeeUseCase,
    listSessionAttendeesUseCase,
    updateSessionUseCase,
    cancelSessionUseCase,
    bulkImportAttendeesUseCase,
    markAttendanceUseCase,
    updateAttendeeUseCase,
    deleteAttendeeUseCase,
  }) {
    this.createSessionUseCase = createSessionUseCase;
    this.listSessionsUseCase = listSessionsUseCase;
    this.assignInstructorUseCase = assignInstructorUseCase;
    this.addAttendeeUseCase = addAttendeeUseCase;
    this.listSessionAttendeesUseCase = listSessionAttendeesUseCase;
    this.updateSessionUseCase = updateSessionUseCase;
    this.cancelSessionUseCase = cancelSessionUseCase;
    this.bulkImportAttendeesUseCase = bulkImportAttendeesUseCase;
    this.markAttendanceUseCase = markAttendanceUseCase;
    this.updateAttendeeUseCase = updateAttendeeUseCase;
    this.deleteAttendeeUseCase = deleteAttendeeUseCase;
  }

  create = async (req, res) => {
    try {
      const { trainingId, clientId, startDate, endDate, includeWeekends } = req.body;
      const session = await this.createSessionUseCase.execute({
        requester: req.user,
        trainingId,
        clientId,
        startDate,
        endDate,
        includeWeekends,
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
      const { startDate, endDate, includeWeekends } = req.body;
      const session = await this.updateSessionUseCase.execute({
        requester: req.user,
        sessionId: Number(req.params.id),
        startDate,
        endDate,
        includeWeekends,
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

  importAttendees = async (req, res) => {
    try {
      const result = await this.bulkImportAttendeesUseCase.execute({
        requester: req.user,
        sessionId: Number(req.params.id),
        file: req.file,
      });
      res.status(200).json(result);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  };

  markAttendance = async (req, res) => {
    try {
      const { status } = req.body;
      const attendee = await this.markAttendanceUseCase.execute({
        requester: req.user,
        sessionId: Number(req.params.id),
        attendeeId: Number(req.params.attendeeId),
        status,
      });
      res.status(200).json(attendee);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  };

  updateAttendee = async (req, res) => {
    try {
      const { name, email } = req.body;
      const attendee = await this.updateAttendeeUseCase.execute({
        requester: req.user,
        sessionId: Number(req.params.id),
        attendeeId: Number(req.params.attendeeId),
        name,
        email,
      });
      res.status(200).json(attendee);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  };

  removeAttendee = async (req, res) => {
    try {
      await this.deleteAttendeeUseCase.execute({
        requester: req.user,
        sessionId: Number(req.params.id),
        attendeeId: Number(req.params.attendeeId),
      });
      res.status(204).send();
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  };
}

export { SessionController };
