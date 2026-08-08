import { ListSessionAttendeesUseCase } from '../../../src/use-cases/sessions/ListSessionAttendeesUseCase';

function buildRequester(overrides: Record<string, any> = {}) {
  return {
    id: 1,
    canManageCatalog: () => false,
    isSuperAdmin: () => false,
    isInstructor: () => false,
    ...overrides,
  };
}

function buildRepos(session: any = { id: 5, instructorId: 9 }) {
  return {
    sessionRepository: {
      findById: jest.fn().mockResolvedValue(session),
      listAttendees: jest.fn().mockResolvedValue([{ id: 1, name: 'Jane' }]),
    },
    instructorRepository: {
      findByUserId: jest.fn().mockResolvedValue({ id: 9 }),
    },
  };
}

describe('ListSessionAttendeesUseCase', () => {
  it('throws if the session does not exist', async () => {
    const { sessionRepository, instructorRepository } = buildRepos();
    sessionRepository.findById.mockResolvedValue(null);
    const useCase = new ListSessionAttendeesUseCase({ sessionRepository, instructorRepository });

    await expect(
      useCase.execute({ requester: buildRequester(), sessionId: 5 })
    ).rejects.toThrow('Training session not found');
  });

  it('allows Sales/Manager (canManageCatalog) to view any session\'s attendees', async () => {
    const { sessionRepository, instructorRepository } = buildRepos();
    const useCase = new ListSessionAttendeesUseCase({ sessionRepository, instructorRepository });

    const result = await useCase.execute({
      requester: buildRequester({ canManageCatalog: () => true }),
      sessionId: 5,
    });

    expect(result).toEqual([{ id: 1, name: 'Jane' }]);
  });

  it('allows a SuperAdmin to view any session\'s attendees', async () => {
    const { sessionRepository, instructorRepository } = buildRepos();
    const useCase = new ListSessionAttendeesUseCase({ sessionRepository, instructorRepository });

    await expect(
      useCase.execute({ requester: buildRequester({ isSuperAdmin: () => true }), sessionId: 5 })
    ).resolves.toBeDefined();
  });

  it('allows an Instructor to view attendees of their own assigned session', async () => {
    const { sessionRepository, instructorRepository } = buildRepos({ id: 5, instructorId: 9 });
    const useCase = new ListSessionAttendeesUseCase({ sessionRepository, instructorRepository });

    await expect(
      useCase.execute({ requester: buildRequester({ isInstructor: () => true }), sessionId: 5 })
    ).resolves.toBeDefined();
  });

  it('rejects an Instructor viewing a session that is not their own', async () => {
    const { sessionRepository, instructorRepository } = buildRepos({ id: 5, instructorId: 999 });
    const useCase = new ListSessionAttendeesUseCase({ sessionRepository, instructorRepository });

    await expect(
      useCase.execute({ requester: buildRequester({ isInstructor: () => true }), sessionId: 5 })
    ).rejects.toThrow('not allowed');
  });

  it('rejects a requester who is neither catalog-manager, SuperAdmin, nor the assigned Instructor', async () => {
    const { sessionRepository, instructorRepository } = buildRepos();
    const useCase = new ListSessionAttendeesUseCase({ sessionRepository, instructorRepository });

    await expect(
      useCase.execute({ requester: buildRequester(), sessionId: 5 })
    ).rejects.toThrow('not allowed');
  });
});
