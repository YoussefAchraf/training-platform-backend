const FEEDBACK_CATEGORIES = Object.freeze({
  BUG: 'bug',
  ENHANCEMENT: 'enhancement',
  OTHER: 'other',
});

class FeedbackReport {
  id: any;
  submittedBy: any;
  submitterName: any;
  submitterEmail: any;
  submitterRole: any;
  category: any;
  message: any;
  createdAt: any;

  constructor({ id, submittedBy, submitterName, submitterEmail, submitterRole, category, message, createdAt }: any) {
    this.id = id;
    this.submittedBy = submittedBy;
    this.submitterName = submitterName;
    this.submitterEmail = submitterEmail;
    this.submitterRole = submitterRole;
    this.category = category;
    this.message = message;
    this.createdAt = createdAt;
  }
}

export { FeedbackReport, FEEDBACK_CATEGORIES };
