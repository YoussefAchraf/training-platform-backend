class Survey {
  id: any;
  sessionId: any;
  instructorId: any;
  attendeeId: any;
  instructorScore: any;
  npsScore: any;
  comments: any;
  submittedAt: any;

  constructor({ id, sessionId, instructorId, attendeeId, instructorScore, npsScore, comments, submittedAt }: any) {
    if (instructorScore < 0 || instructorScore > 5) {
      throw new Error('instructorScore must be between 0 and 5');
    }
    if (npsScore < 0 || npsScore > 10) {
      throw new Error('npsScore must be between 0 and 10');
    }
    this.id = id;
    this.sessionId = sessionId;
    this.instructorId = instructorId;
    this.attendeeId = attendeeId;
    this.instructorScore = instructorScore;
    this.npsScore = npsScore;
    this.comments = comments;
    this.submittedAt = submittedAt;
  }
}

export { Survey };
