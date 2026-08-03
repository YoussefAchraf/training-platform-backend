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
      findById: jest.fn().mockResolvedValue({ id: 5 }),
      addAttendee: jest.fn().mockResolvedValue({ id: 1, sessionId: 5, name: 'Attendee', email: 'a@b.com' }),
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

  it('allows a missing (optional) email', async () => {
    const { sessionRepository } = buildRepos();
    const useCase = new AddAttendeeUseCase({ sessionRepository });

    await expect(
      useCase.execute({ requester: buildRequester(), sessionId: 5, name: 'Attendee' })
    ).resolves.toBeDefined();
  });

  it('registers the attendee when the email is valid', async () => {
    const { sessionRepository } = buildRepos();
    const useCase = new AddAttendeeUseCase({ sessionRepository });

    await useCase.execute({ requester: buildRequester(), sessionId: 5, name: '  Attendee  ', email: 'a@b.com' });

    expect(sessionRepository.addAttendee).toHaveBeenCalledWith(5, { name: 'Attendee', email: 'a@b.com' });
  });
});
