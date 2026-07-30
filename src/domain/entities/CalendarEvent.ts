class CalendarEvent {
  id: any;
  sessionId: any;
  eventDate: any;
  title: any;

  constructor({ id, sessionId, eventDate, title }: any) {
    this.id = id;
    this.sessionId = sessionId;
    this.eventDate = eventDate;
    this.title = title;
  }
}

export { CalendarEvent };
