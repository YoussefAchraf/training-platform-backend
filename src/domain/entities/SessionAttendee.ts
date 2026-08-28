const ATTENDANCE_STATUS = Object.freeze({
  PENDING: 'pending',
  PRESENT: 'present',
  ABSENT: 'absent',
});

class SessionAttendee {
  id: any;
  sessionId: any;
  name: any;
  email: any;
  surveySubmitted: any;
  attendanceStatus: any;

  constructor({ id, sessionId, name, email, surveySubmitted = false, attendanceStatus = ATTENDANCE_STATUS.PENDING }: any) {
    this.id = id;
    this.sessionId = sessionId;
    this.name = name;
    this.email = email;
    this.surveySubmitted = surveySubmitted;
    this.attendanceStatus = attendanceStatus;
  }
}

export { SessionAttendee, ATTENDANCE_STATUS };
