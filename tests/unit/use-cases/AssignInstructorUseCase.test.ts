import { AssignInstructorUseCase } from '../../../src/use-cases/sessions/AssignInstructorUseCase';

function buildRequester(overrides: Record<string, any> = {}) {
  return {
    isManager: () => false,
    isSuperAdmin: () => false,
    ...overrides,
  };
}

function buildRepos() {
  return {
    sessionRepository: {
      findById: jest.fn().mockResolvedValue({ id: 5 }),
      assignInstructor: jest.fn().mockResolvedValue({ id: 5, instructorId: 9 }),
    },
    instructorRepository: {
      findById: jest.fn().mockResolvedValue({ id: 9 }),
    },
  };
}

describe('AssignInstructorUseCase', () => {
  it('rejects a requester who is neither Manager nor SuperAdmin', async () => {
    const { sessionRepository, instructorRepository } = buildRepos();
    const useCase = new AssignInstructorUseCase({ sessionRepository, instructorRepository });

    await expect(
      useCase.execute({ requester: buildRequester(), sessionId: 5, instructorId: 9 })
    ).rejects.toThrow('Only a Manager');
    expect(sessionRepository.findById).not.toHaveBeenCalled();
  });

  it('allows a SuperAdmin even though they are not a Manager', async () => {
    const { sessionRepository, instructorRepository } = buildRepos();
    const useCase = new AssignInstructorUseCase({ sessionRepository, instructorRepository });

    await expect(
      useCase.execute({ requester: buildRequester({ isSuperAdmin: () => true }), sessionId: 5, instructorId: 9 })
    ).resolves.toBeDefined();
    expect(sessionRepository.assignInstructor).toHaveBeenCalledWith(5, 9);
  });
});
