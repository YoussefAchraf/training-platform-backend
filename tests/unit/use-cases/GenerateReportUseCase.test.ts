import { GenerateReportUseCase } from '../../../src/use-cases/reports/GenerateReportUseCase';

function buildRequester(overrides: Record<string, any> = {}) {
  return {
    isManager: () => false,
    canManageCatalog: () => false,
    isSuperAdmin: () => false,
    ...overrides,
  };
}

function buildRepos() {
  return {
    sessionRepository: {
      findById: jest.fn().mockResolvedValue({ id: 5 }),
      updateSessionStatus: jest.fn(),
    },
    surveyRepository: {
      getSessionAverages: jest.fn().mockResolvedValue({ average_score: 4.2, nps_average: 8 }),
    },
    reportRepository: {
      create: jest.fn().mockResolvedValue({ id: 1, sessionId: 5 }),
    },
  };
}

describe('GenerateReportUseCase', () => {
  it('rejects a requester who is neither Sales, Manager nor SuperAdmin', async () => {
    const { sessionRepository, surveyRepository, reportRepository } = buildRepos();
    const useCase = new GenerateReportUseCase({ sessionRepository, surveyRepository, reportRepository });

    await expect(
      useCase.execute({ requester: buildRequester(), sessionId: 5 })
    ).rejects.toThrow('Only Sales or Manager');
    expect(sessionRepository.findById).not.toHaveBeenCalled();
  });

  it('allows a SuperAdmin even though they are neither Sales nor Manager', async () => {
    const { sessionRepository, surveyRepository, reportRepository } = buildRepos();
    const useCase = new GenerateReportUseCase({ sessionRepository, surveyRepository, reportRepository });

    await expect(
      useCase.execute({ requester: buildRequester({ isSuperAdmin: () => true }), sessionId: 5 })
    ).resolves.toBeDefined();
    expect(reportRepository.create).toHaveBeenCalled();
  });

  it('allows an automated trigger with no requester', async () => {
    const { sessionRepository, surveyRepository, reportRepository } = buildRepos();
    const useCase = new GenerateReportUseCase({ sessionRepository, surveyRepository, reportRepository });

    await expect(
      useCase.execute({ requester: null, sessionId: 5, triggeredBy: 'auto' })
    ).resolves.toBeDefined();
  });
});
