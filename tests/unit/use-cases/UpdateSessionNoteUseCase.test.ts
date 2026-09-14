import { UpdateSessionNoteUseCase } from '../../../src/use-cases/sessions/UpdateSessionNoteUseCase';

function buildRequester(overrides: Record<string, any> = {}) {
  return {
    id: 1,
    isInstructor: () => false,
    ...overrides,
  };
}

function buildRepos(
  session: any = { id: 5, instructorId: 9 },
  note: any = { id: 1, sessionId: 5, instructorId: 9, body: 'Old body' },
) {
  return {
    sessionRepository: {
      findById: jest.fn().mockResolvedValue(session),
    },
    instructorRepository: {
      findByUserId: jest.fn().mockResolvedValue({ id: 9 }),
    },
    sessionNoteRepository: {
      findById: jest.fn().mockResolvedValue(note),
      update: jest.fn().mockResolvedValue({ id: 1, sessionId: 5, instructorId: 9, body: 'New body' }),
    },
  };
}

describe('UpdateSessionNoteUseCase', () => {
  it('throws if the session does not exist', async () => {
    const repos = buildRepos();
    repos.sessionRepository.findById.mockResolvedValue(null);
    const useCase = new UpdateSessionNoteUseCase(repos);

    await expect(
      useCase.execute({ requester: buildRequester(), sessionId: 5, noteId: 1, body: 'New body' })
    ).rejects.toThrow('Training session not found');
  });

  it('rejects a non-Instructor requester', async () => {
    const repos = buildRepos();
    const useCase = new UpdateSessionNoteUseCase(repos);

    await expect(
      useCase.execute({ requester: buildRequester(), sessionId: 5, noteId: 1, body: 'New body' })
    ).rejects.toThrow('Only the note author');
  });

  it('rejects an Instructor not assigned to this session', async () => {
    const repos = buildRepos({ id: 5, instructorId: 999 });
    const useCase = new UpdateSessionNoteUseCase(repos);

    await expect(
      useCase.execute({
        requester: buildRequester({ isInstructor: () => true }),
        sessionId: 5,
        noteId: 1,
        body: 'New body',
      })
    ).rejects.toThrow('Only the note author');
  });

  it('rejects when the note does not belong to this session', async () => {
    const repos = buildRepos({ id: 5, instructorId: 9 }, { id: 1, sessionId: 999, instructorId: 9 });
    const useCase = new UpdateSessionNoteUseCase(repos);

    await expect(
      useCase.execute({
        requester: buildRequester({ isInstructor: () => true }),
        sessionId: 5,
        noteId: 1,
        body: 'New body',
      })
    ).rejects.toThrow('Note not found for this session');
  });

  it('rejects when the note does not exist', async () => {
    const repos = buildRepos();
    repos.sessionNoteRepository.findById.mockResolvedValue(null);
    const useCase = new UpdateSessionNoteUseCase(repos);

    await expect(
      useCase.execute({
        requester: buildRequester({ isInstructor: () => true }),
        sessionId: 5,
        noteId: 1,
        body: 'New body',
      })
    ).rejects.toThrow('Note not found for this session');
  });

  it('rejects an empty body', async () => {
    const repos = buildRepos();
    const useCase = new UpdateSessionNoteUseCase(repos);

    await expect(
      useCase.execute({
        requester: buildRequester({ isInstructor: () => true }),
        sessionId: 5,
        noteId: 1,
        body: '   ',
      })
    ).rejects.toThrow('Note body is required');
  });

  it('updates the note with a trimmed body', async () => {
    const repos = buildRepos();
    const useCase = new UpdateSessionNoteUseCase(repos);

    const result = await useCase.execute({
      requester: buildRequester({ isInstructor: () => true }),
      sessionId: 5,
      noteId: 1,
      body: '  New body  ',
    });

    expect(repos.sessionNoteRepository.update).toHaveBeenCalledWith(1, 'New body');
    expect(result).toEqual({ id: 1, sessionId: 5, instructorId: 9, body: 'New body' });
  });
});
