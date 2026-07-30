class ListGlobalCalendarUseCase {
  calendarRepository: any;

  constructor({ calendarRepository }) {
    this.calendarRepository = calendarRepository;
  }

  async execute() {
    return this.calendarRepository.listGlobal();
  }
}

class UpdateGlobalCalendarUseCase {
  calendarRepository: any;

  constructor({ calendarRepository }) {
    this.calendarRepository = calendarRepository;
  }

  async execute({ requester, eventId, eventDate, title }) {
    if (!requester.canManageCatalog()) {
      throw new Error('Only Sales or Manager can update the global calendar');
    }
    return this.calendarRepository.update(eventId, { eventDate, title });
  }
}

class DeleteGlobalCalendarEventUseCase {
  calendarRepository: any;

  constructor({ calendarRepository }) {
    this.calendarRepository = calendarRepository;
  }

  async execute({ requester, eventId }) {
    if (!requester.canManageCatalog()) {
      throw new Error('Only Sales or Manager can delete a calendar event');
    }
    return this.calendarRepository.delete(eventId);
  }
}

export { ListGlobalCalendarUseCase, UpdateGlobalCalendarUseCase, DeleteGlobalCalendarEventUseCase };
