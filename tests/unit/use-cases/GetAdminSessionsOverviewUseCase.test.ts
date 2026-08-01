import { GetAdminSessionsOverviewUseCase } from '../../../src/use-cases/admin/GetAdminSessionsOverviewUseCase';

function buildRequester(overrides: Record<string, any> = {}) {
  return {
    isSuperAdmin: () => false,
    ...overrides,
  };
}

describe('GetAdminSessionsOverviewUseCase', () => {
  it('rejects a requester who is not SuperAdmin', async () => {
    const sessionRepository = { listAllWithDetails: jest.fn() };
    const useCase = new GetAdminSessionsOverviewUseCase({ sessionRepository });

    await expect(useCase.execute({ requester: buildRequester() })).rejects.toThrow('Only a SuperAdmin');
    expect(sessionRepository.listAllWithDetails).not.toHaveBeenCalled();
  });

  it('returns the aggregated overview for a SuperAdmin', async () => {
    const overview = [{ id: 1, trainingName: 'T', creatorName: 'A B', hasReport: false }];
    const sessionRepository = { listAllWithDetails: jest.fn().mockResolvedValue(overview) };
    const useCase = new GetAdminSessionsOverviewUseCase({ sessionRepository });

    const result = await useCase.execute({ requester: buildRequester({ isSuperAdmin: () => true }) });

    expect(result).toEqual(overview);
  });
});
