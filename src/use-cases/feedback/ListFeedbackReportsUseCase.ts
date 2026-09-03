class ListFeedbackReportsUseCase {
  feedbackRepository: any;

  constructor({ feedbackRepository }) {
    this.feedbackRepository = feedbackRepository;
  }

  async execute({ requester }: { requester: any }) {
    if (!requester.isDeveloper()) {
      throw new Error('Only Developer can view feedback reports');
    }

    return this.feedbackRepository.listAll();
  }
}

export { ListFeedbackReportsUseCase };
