class CalendarController {
  listGlobalCalendarUseCase: any;
  updateGlobalCalendarUseCase: any;
  deleteGlobalCalendarEventUseCase: any;
  listMyCalendarUseCase: any;

  constructor({
    listGlobalCalendarUseCase,
    updateGlobalCalendarUseCase,
    deleteGlobalCalendarEventUseCase,
    listMyCalendarUseCase,
  }) {
    this.listGlobalCalendarUseCase = listGlobalCalendarUseCase;
    this.updateGlobalCalendarUseCase = updateGlobalCalendarUseCase;
    this.deleteGlobalCalendarEventUseCase = deleteGlobalCalendarEventUseCase;
    this.listMyCalendarUseCase = listMyCalendarUseCase;
  }

  listGlobal = async (req, res) => {
    try {
      const events = await this.listGlobalCalendarUseCase.execute();
      res.status(200).json(events);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  };

  updateGlobal = async (req, res) => {
    try {
      const { eventDate, title } = req.body;
      const event = await this.updateGlobalCalendarUseCase.execute({
        requester: req.user,
        eventId: Number(req.params.id),
        eventDate,
        title,
      });
      res.status(200).json(event);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  };

  deleteGlobal = async (req, res) => {
    try {
      await this.deleteGlobalCalendarEventUseCase.execute({
        requester: req.user,
        eventId: Number(req.params.id),
      });
      res.status(204).send();
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  };

  listMine = async (req, res) => {
    try {
      const events = await this.listMyCalendarUseCase.execute({ requester: req.user });
      res.status(200).json(events);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  };
}

export { CalendarController };
