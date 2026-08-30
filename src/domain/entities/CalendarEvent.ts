class CalendarEvent {
  id: any;
  sessionId: any;
  eventDate: any;
  endDate: any;
  title: any;
  includeWeekends: any;

  constructor({ id, sessionId, eventDate, endDate, title, includeWeekends = false }: any) {
    this.id = id;
    this.sessionId = sessionId;
    this.eventDate = eventDate;
    this.endDate = endDate;
    this.title = title;
    this.includeWeekends = includeWeekends;
  }
}

export { CalendarEvent };
