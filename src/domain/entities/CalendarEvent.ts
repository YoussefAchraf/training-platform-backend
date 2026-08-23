class CalendarEvent {
  id: any;
  sessionId: any;
  eventDate: any;
  endDate: any;
  title: any;

  constructor({ id, sessionId, eventDate, endDate, title }: any) {
    this.id = id;
    this.sessionId = sessionId;
    this.eventDate = eventDate;
    this.endDate = endDate;
    this.title = title;
  }
}

export { CalendarEvent };
