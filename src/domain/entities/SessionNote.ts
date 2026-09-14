class SessionNote {
  id: any;
  sessionId: any;
  instructorId: any;
  body: any;
  createdAt: any;
  updatedAt: any;

  constructor({ id, sessionId, instructorId, body, createdAt, updatedAt }: any) {
    this.id = id;
    this.sessionId = sessionId;
    this.instructorId = instructorId;
    this.body = body;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
  }
}

export { SessionNote };
