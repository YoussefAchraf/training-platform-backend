const SESSION_STATUS = Object.freeze({
  SCHEDULED: 'scheduled',
  ONGOING: 'ongoing',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
});

const ASSIGNMENT_STATUS = Object.freeze({
  UNASSIGNED: 'unassigned',
  PENDING: 'pending',
  ACCEPTED: 'accepted',
  REFUSED: 'refused',
});

const SESSION_LOCATION_TYPE = Object.freeze({
  ONSITE: 'onsite',
  REMOTE: 'remote',
});

class TrainingSession {
  id: any;
  trainingId: any;
  clientId: any;
  instructorId: any;
  startDate: any;
  endDate: any;
  sessionStatus: any;
  assignmentStatus: any;
  includeWeekends: any;
  locationType: any;
  createdBy: any;
  createdAt: any;

  constructor({
    id,
    trainingId,
    clientId,
    instructorId,
    startDate,
    endDate,
    sessionStatus = SESSION_STATUS.SCHEDULED,
    assignmentStatus = ASSIGNMENT_STATUS.UNASSIGNED,
    includeWeekends = false,
    locationType = SESSION_LOCATION_TYPE.ONSITE,
    createdBy,
    createdAt,
  }: any) {
    this.id = id;
    this.trainingId = trainingId;
    this.clientId = clientId;
    this.instructorId = instructorId;
    this.startDate = startDate;
    this.endDate = endDate;
    this.sessionStatus = sessionStatus;
    this.assignmentStatus = assignmentStatus;
    this.includeWeekends = includeWeekends;
    this.locationType = locationType;
    this.createdBy = createdBy;
    this.createdAt = createdAt;
  }

  hasEnded() {
    return new Date(this.endDate).getTime() <= Date.now();
  }

  minutesSinceEnd() {
    return (Date.now() - new Date(this.endDate).getTime()) / 60000;
  }
}

export { TrainingSession, SESSION_STATUS, ASSIGNMENT_STATUS, SESSION_LOCATION_TYPE };
