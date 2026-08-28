import { AddAttendeeUseCase } from '../../../src/use-cases/sessions/AddAttendeeUseCase';

function buildRequester(overrides: Record<string, any> = {}) {
  return {
    canManageCatalog: () => true,
    ...overrides,
  };
}

function buildRepos() {
  return {
    sessionRepository: {
      findById: jest.fn().mockResolvedValue({
        id: 5,
        startDate: '2026-09-01T09:00:00Z',
        endDate: '2026-09-01T17:00:00Z',
      }),
      addAttendee: jest.fn().mockResolvedValue({ id: 1, sessionId: 5, name: 'Attendee', email: 'a@b.com' }),
      findOverlappingAttendeeSession: jest.fn().mockResolvedValue(null),
    },
  };
}

describe('AddAttendeeUseCase', () => {
  it('rejects a requester who cannot manage the catalog', async () => {
    const { sessionRepository } = buildRepos();
    const useCase = new AddAttendeeUseCase({ sessionRepository });

    await expect(
      useCase.execute({ requester: buildRequester({ canManageCatalog: () => false }), sessionId: 5, name: 'X' })
    ).rejects.toThrow('Only Sales or Manager');
  });

  it('rejects a session that does not exist', async () => {
    const { sessionRepository } = buildRepos();
    sessionRepository.findById.mockResolvedValue(null);
    const useCase = new AddAttendeeUseCase({ sessionRepository });

    await expect(
      useCase.execute({ requester: buildRequester(), sessionId: 999, name: 'X' })
    ).rejects.toThrow('Training session not found');
  });

  it('rejects a missing attendee name', async () => {
    const { sessionRepository } = buildRepos();
    const useCase = new AddAttendeeUseCase({ sessionRepository });

    await expect(
      useCase.execute({ requester: buildRequester(), sessionId: 5, name: '  ' })
    ).rejects.toThrow('Attendee name is required');
  });

  it('rejects a malformed email address', async () => {
    const { sessionRepository } = buildRepos();
    const useCase = new AddAttendeeUseCase({ sessionRepository });

    await expect(
      useCase.execute({ requester: buildRequester(), sessionId: 5, name: 'Attendee', email: 'not-an-email' })
    ).rejects.toThrow('valid email');
    expect(sessionRepository.addAttendee).not.toHaveBeenCalled();
  });

  it('allows a missing (optional) email, and skips the overlap check entirely', async () => {
    const { sessionRepository } = buildRepos();
    const useCase = new AddAttendeeUseCase({ sessionRepository });

    await expect(
      useCase.execute({ requester: buildRequester(), sessionId: 5, name: 'Attendee' })
    ).resolves.toBeDefined();
    expect(sessionRepository.findOverlappingAttendeeSession).not.toHaveBeenCalled();
  });

  it('rejects an attendee already registered in another session that overlaps this one', async () => {
    const { sessionRepository } = buildRepos();
    sessionRepository.findOverlappingAttendeeSession.mockResolvedValue({ id: 7 });
    const useCase = new AddAttendeeUseCase({ sessionRepository });

    await expect(
      useCase.execute({ requester: buildRequester(), sessionId: 5, name: 'Attendee', email: 'a@b.com' })
    ).rejects.toThrow('already registered in another session that overlaps');
    expect(sessionRepository.addAttendee).not.toHaveBeenCalled();
  });

  it('registers the attendee when the email is valid', async () => {
    const { sessionRepository } = buildRepos();
    const useCase = new AddAttendeeUseCase({ sessionRepository });

    await useCase.execute({ requester: buildRequester(), sessionId: 5, name: '  Attendee  ', email: 'a@b.com' });

    expect(sessionRepository.addAttendee).toHaveBeenCalledWith(5, { name: 'Attendee', email: 'a@b.com' });
    expect(sessionRepository.findOverlappingAttendeeSession).toHaveBeenCalledWith({
      email: 'a@b.com',
      sessionId: 5,
      startDate: '2026-09-01T09:00:00Z',
      endDate: '2026-09-01T17:00:00Z',
    });
  });
});
