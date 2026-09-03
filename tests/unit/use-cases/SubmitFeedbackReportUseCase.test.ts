import { SubmitFeedbackReportUseCase } from '../../../src/use-cases/feedback/SubmitFeedbackReportUseCase';

function buildRequester(overrides: Record<string, any> = {}) {
  return {
    id: 1,
    isDeveloper: () => false,
    ...overrides,
  };
}

describe('SubmitFeedbackReportUseCase', () => {
  it('rejects a Developer requester', async () => {
    const feedbackRepository = { create: jest.fn() };
    const useCase = new SubmitFeedbackReportUseCase({ feedbackRepository });

    await expect(
      useCase.execute({ requester: buildRequester({ isDeveloper: () => true }), category: 'bug', message: 'x' })
    ).rejects.toThrow('Developer accounts cannot submit feedback');
    expect(feedbackRepository.create).not.toHaveBeenCalled();
  });

  it('rejects an invalid category', async () => {
    const feedbackRepository = { create: jest.fn() };
    const useCase = new SubmitFeedbackReportUseCase({ feedbackRepository });

    await expect(
      useCase.execute({ requester: buildRequester(), category: 'not-a-real-category', message: 'x' })
    ).rejects.toThrow('category must be one of');
    expect(feedbackRepository.create).not.toHaveBeenCalled();
  });

  it('rejects an empty message', async () => {
    const feedbackRepository = { create: jest.fn() };
    const useCase = new SubmitFeedbackReportUseCase({ feedbackRepository });

    await expect(
      useCase.execute({ requester: buildRequester(), category: 'bug', message: '   ' })
    ).rejects.toThrow('message is required');
    expect(feedbackRepository.create).not.toHaveBeenCalled();
  });

  it('submits a trimmed report for a valid category', async () => {
    const created = { id: 1, category: 'enhancement', message: 'Add dark mode' };
    const feedbackRepository = { create: jest.fn().mockResolvedValue(created) };
    const useCase = new SubmitFeedbackReportUseCase({ feedbackRepository });

    const result = await useCase.execute({
      requester: buildRequester({ id: 7 }),
      category: 'enhancement',
      message: '  Add dark mode  ',
    });

    expect(feedbackRepository.create).toHaveBeenCalledWith({
      submittedBy: 7,
      category: 'enhancement',
      message: 'Add dark mode',
    });
    expect(result).toEqual(created);
  });
});
