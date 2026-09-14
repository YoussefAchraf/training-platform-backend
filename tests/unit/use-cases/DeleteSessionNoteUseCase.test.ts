import { DeleteSessionNoteUseCase } from '../../../src/use-cases/sessions/DeleteSessionNoteUseCase';

function buildRequester(overrides: Record<string, any> = {}) {
  return {
    id: 1,
    isInstructor: () => false,
    ...overrides,
  };
}

function buildRepos(
  session: any = { id: 5, instructorId: 9 },
  note: any = { id: 1, sessionId: 5, instructorId: 9 },
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
      delete: jest.fn().mockResolvedValue(undefined),
    },
  };
}

describe('DeleteSessionNoteUseCase', () => {
  it('throws if the session does not exist', async () => {
    const repos = buildRepos();
    repos.sessionRepository.findById.mockResolvedValue(null);
    const useCase = new DeleteSessionNoteUseCase(repos);

    await expect(
      useCase.execute({ requester: buildRequester(), sessionId: 5, noteId: 1 })
    ).rejects.toThrow('Training session not found');
  });

  it('rejects a non-Instructor requester', async () => {
    const repos = buildRepos();
    const useCase = new DeleteSessionNoteUseCase(repos);

    await expect(
      useCase.execute({ requester: buildRequester(), sessionId: 5, noteId: 1 })
    ).rejects.toThrow('Only the note author');
  });

  it('rejects an Instructor not assigned to this session', async () => {
    const repos = buildRepos({ id: 5, instructorId: 999 });
    const useCase = new DeleteSessionNoteUseCase(repos);

    await expect(
      useCase.execute({ requester: buildRequester({ isInstructor: () => true }), sessionId: 5, noteId: 1 })
    ).rejects.toThrow('Only the note author');
  });

  it('rejects when the note does not belong to this session', async () => {
    const repos = buildRepos({ id: 5, instructorId: 9 }, { id: 1, sessionId: 999, instructorId: 9 });
    const useCase = new DeleteSessionNoteUseCase(repos);

    await expect(
      useCase.execute({ requester: buildRequester({ isInstructor: () => true }), sessionId: 5, noteId: 1 })
    ).rejects.toThrow('Note not found for this session');
  });

  it('deletes the note when the requester is the assigned Instructor', async () => {
    const repos = buildRepos();
    const useCase = new DeleteSessionNoteUseCase(repos);

    await useCase.execute({ requester: buildRequester({ isInstructor: () => true }), sessionId: 5, noteId: 1 });

    expect(repos.sessionNoteRepository.delete).toHaveBeenCalledWith(1);
  });
});
