import { UpdateInstructorByManagerUseCase } from '../../../src/use-cases/instructors/UpdateInstructorByManagerUseCase';

function buildRequester(overrides: Record<string, any> = {}) {
  return {
    isManager: () => false,
    isSuperAdmin: () => false,
    ...overrides,
  };
}

function buildRepo() {
  return {
    instructorRepository: {
      findById: jest.fn().mockResolvedValue({ id: 3, bio: 'old' }),
      updateBio: jest.fn(),
      setSkills: jest.fn(),
    },
  };
}

describe('UpdateInstructorByManagerUseCase', () => {
  it('rejects a requester who is neither Manager nor SuperAdmin', async () => {
    const { instructorRepository } = buildRepo();
    const useCase = new UpdateInstructorByManagerUseCase({ instructorRepository });

    await expect(
      useCase.execute({ requester: buildRequester(), instructorId: 3, bio: 'new' })
    ).rejects.toThrow('Only a Manager');
    expect(instructorRepository.findById).not.toHaveBeenCalled();
  });

  it('allows a SuperAdmin even though they are not a Manager', async () => {
    const { instructorRepository } = buildRepo();
    const useCase = new UpdateInstructorByManagerUseCase({ instructorRepository });

    await expect(
      useCase.execute({ requester: buildRequester({ isSuperAdmin: () => true }), instructorId: 3, bio: 'new' })
    ).resolves.toBeDefined();
    expect(instructorRepository.updateBio).toHaveBeenCalledWith(3, 'new');
  });
});
