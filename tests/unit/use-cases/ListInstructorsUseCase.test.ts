import { ListInstructorsUseCase } from '../../../src/use-cases/instructors/ListInstructorsUseCase';

function buildRequester(overrides: Record<string, any> = {}) {
  return {
    isSuperAdmin: () => false,
    ...overrides,
  };
}

describe('ListInstructorsUseCase', () => {
  it('asks the repository for approved-only instructors for a non-SuperAdmin requester', async () => {
    const instructorRepository = { listAll: jest.fn().mockResolvedValue([]) };
    const useCase = new ListInstructorsUseCase({ instructorRepository });

    await useCase.execute({ requester: buildRequester() });

    expect(instructorRepository.listAll).toHaveBeenCalledWith({ includeAllStatuses: false });
  });

  it('asks the repository for every status for a SuperAdmin requester', async () => {
    const instructorRepository = { listAll: jest.fn().mockResolvedValue([]) };
    const useCase = new ListInstructorsUseCase({ instructorRepository });

    await useCase.execute({ requester: buildRequester({ isSuperAdmin: () => true }) });

    expect(instructorRepository.listAll).toHaveBeenCalledWith({ includeAllStatuses: true });
  });
});
