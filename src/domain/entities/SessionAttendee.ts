class SessionAttendee {
  id: any;
  sessionId: any;
  name: any;
  email: any;
  surveySubmitted: any;

  constructor({ id, sessionId, name, email, surveySubmitted = false }: any) {
    this.id = id;
    this.sessionId = sessionId;
    this.name = name;
    this.email = email;
    this.surveySubmitted = surveySubmitted;
  }
}

export { SessionAttendee };
