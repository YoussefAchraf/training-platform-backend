import { ListFeedbackReportsUseCase } from '../../../src/use-cases/feedback/ListFeedbackReportsUseCase';

function buildRequester(overrides: Record<string, any> = {}) {
  return {
    isDeveloper: () => false,
    ...overrides,
  };
}

describe('ListFeedbackReportsUseCase', () => {
  it('rejects a requester who is not Developer', async () => {
    const feedbackRepository = { listAll: jest.fn() };
    const useCase = new ListFeedbackReportsUseCase({ feedbackRepository });

    await expect(useCase.execute({ requester: buildRequester() })).rejects.toThrow(
      'Only Developer can view feedback reports'
    );
    expect(feedbackRepository.listAll).not.toHaveBeenCalled();
  });

  it('returns every report for a Developer', async () => {
    const reports = [{ id: 1, category: 'bug', message: 'It broke' }];
    const feedbackRepository = { listAll: jest.fn().mockResolvedValue(reports) };
    const useCase = new ListFeedbackReportsUseCase({ feedbackRepository });

    const result = await useCase.execute({ requester: buildRequester({ isDeveloper: () => true }) });

    expect(result).toEqual(reports);
  });
});
