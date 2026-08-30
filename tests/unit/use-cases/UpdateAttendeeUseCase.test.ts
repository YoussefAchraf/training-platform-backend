import { UpdateAttendeeUseCase } from '../../../src/use-cases/sessions/UpdateAttendeeUseCase';

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
      findAttendeeById: jest.fn().mockResolvedValue({ id: 1, sessionId: 5, name: 'Old Name', email: 'old@b.com' }),
      updateAttendee: jest.fn().mockResolvedValue({ id: 1, sessionId: 5, name: 'New Name', email: 'new@b.com' }),
      findOverlappingAttendeeSession: jest.fn().mockResolvedValue(null),
    },
  };
}

describe('UpdateAttendeeUseCase', () => {
  it('rejects a requester who cannot manage the catalog', async () => {
    const { sessionRepository } = buildRepos();
    const useCase = new UpdateAttendeeUseCase({ sessionRepository });

    await expect(
      useCase.execute({ requester: buildRequester({ canManageCatalog: () => false }), sessionId: 5, attendeeId: 1, name: 'X' })
    ).rejects.toThrow('Only Sales or Manager');
  });

  it('rejects a session that does not exist', async () => {
    const { sessionRepository } = buildRepos();
    sessionRepository.findById.mockResolvedValue(null);
    const useCase = new UpdateAttendeeUseCase({ sessionRepository });

    await expect(
      useCase.execute({ requester: buildRequester(), sessionId: 999, attendeeId: 1, name: 'X' })
    ).rejects.toThrow('Training session not found');
  });

  it('rejects an attendee that does not belong to this session', async () => {
    const { sessionRepository } = buildRepos();
    sessionRepository.findAttendeeById.mockResolvedValue({ id: 1, sessionId: 999, name: 'Old Name' });
    const useCase = new UpdateAttendeeUseCase({ sessionRepository });

    await expect(
      useCase.execute({ requester: buildRequester(), sessionId: 5, attendeeId: 1, name: 'X' })
    ).rejects.toThrow('Attendee not found for this session');
  });

  it('rejects an unknown attendee', async () => {
    const { sessionRepository } = buildRepos();
    sessionRepository.findAttendeeById.mockResolvedValue(null);
    const useCase = new UpdateAttendeeUseCase({ sessionRepository });

    await expect(
      useCase.execute({ requester: buildRequester(), sessionId: 5, attendeeId: 999, name: 'X' })
    ).rejects.toThrow('Attendee not found for this session');
  });

  it('rejects a missing attendee name', async () => {
    const { sessionRepository } = buildRepos();
    const useCase = new UpdateAttendeeUseCase({ sessionRepository });

    await expect(
      useCase.execute({ requester: buildRequester(), sessionId: 5, attendeeId: 1, name: '  ' })
    ).rejects.toThrow('Attendee name is required');
  });

  it('rejects a malformed email address', async () => {
    const { sessionRepository } = buildRepos();
    const useCase = new UpdateAttendeeUseCase({ sessionRepository });

    await expect(
      useCase.execute({ requester: buildRequester(), sessionId: 5, attendeeId: 1, name: 'Attendee', email: 'not-an-email' })
    ).rejects.toThrow('valid email');
    expect(sessionRepository.updateAttendee).not.toHaveBeenCalled();
  });

  it('rejects an email that overlaps another session', async () => {
    const { sessionRepository } = buildRepos();
    sessionRepository.findOverlappingAttendeeSession.mockResolvedValue({ id: 7 });
    const useCase = new UpdateAttendeeUseCase({ sessionRepository });

    await expect(
      useCase.execute({ requester: buildRequester(), sessionId: 5, attendeeId: 1, name: 'Attendee', email: 'a@b.com' })
    ).rejects.toThrow('already registered in another session that overlaps');
    expect(sessionRepository.updateAttendee).not.toHaveBeenCalled();
  });

  it('allows a missing (optional) email, and skips the overlap check entirely', async () => {
    const { sessionRepository } = buildRepos();
    const useCase = new UpdateAttendeeUseCase({ sessionRepository });

    await expect(
      useCase.execute({ requester: buildRequester(), sessionId: 5, attendeeId: 1, name: 'Attendee' })
    ).resolves.toBeDefined();
    expect(sessionRepository.findOverlappingAttendeeSession).not.toHaveBeenCalled();
  });

  it('updates the attendee with a trimmed name when everything is valid', async () => {
    const { sessionRepository } = buildRepos();
    const useCase = new UpdateAttendeeUseCase({ sessionRepository });

    await useCase.execute({ requester: buildRequester(), sessionId: 5, attendeeId: 1, name: '  New Name  ', email: 'new@b.com' });

    expect(sessionRepository.updateAttendee).toHaveBeenCalledWith(1, { name: 'New Name', email: 'new@b.com' });
  });
});
