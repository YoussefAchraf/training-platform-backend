import { FEEDBACK_CATEGORIES } from '../../domain/entities/FeedbackReport';

class SubmitFeedbackReportUseCase {
  feedbackRepository: any;

  constructor({ feedbackRepository }) {
    this.feedbackRepository = feedbackRepository;
  }

  async execute({ requester, category, message }: { requester: any; category: any; message: any }) {
    if (requester.isDeveloper()) {
      throw new Error('Developer accounts cannot submit feedback');
    }

    if (!Object.values(FEEDBACK_CATEGORIES).includes(category)) {
      throw new Error(`category must be one of: ${Object.values(FEEDBACK_CATEGORIES).join(', ')}`);
    }

    if (!message || !message.trim()) {
      throw new Error('message is required');
    }

    return this.feedbackRepository.create({
      submittedBy: requester.id,
      category,
      message: message.trim(),
    });
  }
}

export { SubmitFeedbackReportUseCase };
