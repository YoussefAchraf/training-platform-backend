import { CreateSessionNoteUseCase } from '../../../src/use-cases/sessions/CreateSessionNoteUseCase';

function buildRequester(overrides: Record<string, any> = {}) {
  return {
    id: 1,
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
      create: jest.fn().mockResolvedValue({ id: 1, sessionId: 5, instructorId: 9, body: 'Great session' }),
    },
  };
}

describe('CreateSessionNoteUseCase', () => {
  it('throws if the session does not exist', async () => {
    const repos = buildRepos();
    repos.sessionRepository.findById.mockResolvedValue(null);
    const useCase = new CreateSessionNoteUseCase(repos);

    await expect(
      useCase.execute({ requester: buildRequester(), sessionId: 5, body: 'Hello' })
    ).rejects.toThrow('Training session not found');
  });

  it('rejects a non-Instructor requester', async () => {
    const repos = buildRepos();
    const useCase = new CreateSessionNoteUseCase(repos);

    await expect(
      useCase.execute({ requester: buildRequester(), sessionId: 5, body: 'Hello' })
    ).rejects.toThrow('Only the assigned Instructor');
  });

  it('rejects an Instructor who is not assigned to this session', async () => {
    const repos = buildRepos({ id: 5, instructorId: 999 });
    const useCase = new CreateSessionNoteUseCase(repos);

    await expect(
      useCase.execute({ requester: buildRequester({ isInstructor: () => true }), sessionId: 5, body: 'Hello' })
    ).rejects.toThrow('Only the assigned Instructor');
  });

  it('rejects an empty note body', async () => {
    const repos = buildRepos();
    const useCase = new CreateSessionNoteUseCase(repos);

    await expect(
      useCase.execute({ requester: buildRequester({ isInstructor: () => true }), sessionId: 5, body: '   ' })
    ).rejects.toThrow('Note body is required');
  });

  it('rejects a note body over the max length', async () => {
    const repos = buildRepos();
    const useCase = new CreateSessionNoteUseCase(repos);

    await expect(
      useCase.execute({
        requester: buildRequester({ isInstructor: () => true }),
        sessionId: 5,
        body: 'x'.repeat(5001),
      })
    ).rejects.toThrow('at most 5000 characters');
  });

  it('creates a trimmed note for the assigned Instructor', async () => {
    const repos = buildRepos();
    const useCase = new CreateSessionNoteUseCase(repos);

    const result = await useCase.execute({
      requester: buildRequester({ isInstructor: () => true }),
      sessionId: 5,
      body: '  Great session  ',
    });

    expect(repos.sessionNoteRepository.create).toHaveBeenCalledWith({
      sessionId: 5,
      instructorId: 9,
      body: 'Great session',
    });
    expect(result).toEqual({ id: 1, sessionId: 5, instructorId: 9, body: 'Great session' });
  });
});
