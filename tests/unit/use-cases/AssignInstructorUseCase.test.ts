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
      findById: jest.fn().mockResolvedValue({ id: 5, trainingId: 3 }),
      assignInstructor: jest.fn().mockResolvedValue({ id: 5, instructorId: 9 }),
    },
    instructorRepository: {
      findById: jest.fn().mockResolvedValue({ id: 9, status: 'approved' }),
      isQualifiedForTraining: jest.fn().mockResolvedValue(true),
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
    expect(instructorRepository.isQualifiedForTraining).toHaveBeenCalledWith(9, 3);
  });

  it('rejects an instructor who is not approved (still pending or rejected)', async () => {
    const { sessionRepository, instructorRepository } = buildRepos();
    instructorRepository.findById.mockResolvedValue({ id: 9, status: 'pending' });
    const useCase = new AssignInstructorUseCase({ sessionRepository, instructorRepository });

    await expect(
      useCase.execute({ requester: buildRequester({ isManager: () => true }), sessionId: 5, instructorId: 9 })
    ).rejects.toThrow('not an active, approved instructor');
    expect(sessionRepository.assignInstructor).not.toHaveBeenCalled();
  });

  it('rejects an instructor who is not qualified for this session\'s training', async () => {
    const { sessionRepository, instructorRepository } = buildRepos();
    instructorRepository.isQualifiedForTraining.mockResolvedValue(false);
    const useCase = new AssignInstructorUseCase({ sessionRepository, instructorRepository });

    await expect(
      useCase.execute({ requester: buildRequester({ isManager: () => true }), sessionId: 5, instructorId: 9 })
    ).rejects.toThrow('not marked as qualified');
    expect(sessionRepository.assignInstructor).not.toHaveBeenCalled();
  });
});
