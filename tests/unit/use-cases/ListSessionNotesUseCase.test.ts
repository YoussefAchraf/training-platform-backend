import { ListSessionNotesUseCase } from '../../../src/use-cases/sessions/ListSessionNotesUseCase';

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
    },
    instructorRepository: {
      findByUserId: jest.fn().mockResolvedValue({ id: 9 }),
    },
    sessionNoteRepository: {
      listBySessionId: jest.fn().mockResolvedValue([{ id: 1, body: 'Note' }]),
    },
  };
}

describe('ListSessionNotesUseCase', () => {
  it('throws if the session does not exist', async () => {
    const repos = buildRepos();
    repos.sessionRepository.findById.mockResolvedValue(null);
    const useCase = new ListSessionNotesUseCase(repos);

    await expect(
      useCase.execute({ requester: buildRequester(), sessionId: 5 })
    ).rejects.toThrow('Training session not found');
  });

  it('allows Sales/Manager (canManageCatalog) to view any session\'s notes', async () => {
    const repos = buildRepos();
    const useCase = new ListSessionNotesUseCase(repos);

    const result = await useCase.execute({
      requester: buildRequester({ canManageCatalog: () => true }),
      sessionId: 5,
    });

    expect(result).toEqual([{ id: 1, body: 'Note' }]);
  });

  it('allows a SuperAdmin to view any session\'s notes', async () => {
    const repos = buildRepos();
    const useCase = new ListSessionNotesUseCase(repos);

    await expect(
      useCase.execute({ requester: buildRequester({ isSuperAdmin: () => true }), sessionId: 5 })
    ).resolves.toBeDefined();
  });

  it('allows the assigned Instructor to view their own session\'s notes', async () => {
    const repos = buildRepos({ id: 5, instructorId: 9 });
    const useCase = new ListSessionNotesUseCase(repos);

    await expect(
      useCase.execute({ requester: buildRequester({ isInstructor: () => true }), sessionId: 5 })
    ).resolves.toBeDefined();
  });

  it('rejects an Instructor viewing a session that is not their own', async () => {
    const repos = buildRepos({ id: 5, instructorId: 999 });
    const useCase = new ListSessionNotesUseCase(repos);

    await expect(
      useCase.execute({ requester: buildRequester({ isInstructor: () => true }), sessionId: 5 })
    ).rejects.toThrow('not allowed');
  });

  it('rejects a requester who is neither catalog-manager, SuperAdmin, nor the assigned Instructor', async () => {
    const repos = buildRepos();
    const useCase = new ListSessionNotesUseCase(repos);

    await expect(
      useCase.execute({ requester: buildRequester(), sessionId: 5 })
    ).rejects.toThrow('not allowed');
  });
});
