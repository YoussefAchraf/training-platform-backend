import { DeleteAttendeeUseCase } from '../../../src/use-cases/sessions/DeleteAttendeeUseCase';

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
      findAttendeeById: jest.fn().mockResolvedValue({ id: 1, sessionId: 5, name: 'Jane', surveySubmitted: false }),
      deleteAttendee: jest.fn().mockResolvedValue(undefined),
    },
  };
}

describe('DeleteAttendeeUseCase', () => {
  it('rejects a requester who cannot manage the catalog', async () => {
    const { sessionRepository } = buildRepos();
    const useCase = new DeleteAttendeeUseCase({ sessionRepository });

    await expect(
      useCase.execute({ requester: buildRequester({ canManageCatalog: () => false }), sessionId: 5, attendeeId: 1 })
    ).rejects.toThrow('Only Sales, Manager, or SuperAdmin');
    expect(sessionRepository.deleteAttendee).not.toHaveBeenCalled();
  });

  it('rejects a session that does not exist', async () => {
    const { sessionRepository } = buildRepos();
    sessionRepository.findById.mockResolvedValue(null);
    const useCase = new DeleteAttendeeUseCase({ sessionRepository });

    await expect(
      useCase.execute({ requester: buildRequester(), sessionId: 999, attendeeId: 1 })
    ).rejects.toThrow('Training session not found');
  });

  it('rejects an attendee that does not belong to this session', async () => {
    const { sessionRepository } = buildRepos();
    sessionRepository.findAttendeeById.mockResolvedValue({ id: 1, sessionId: 999, surveySubmitted: false });
    const useCase = new DeleteAttendeeUseCase({ sessionRepository });

    await expect(
      useCase.execute({ requester: buildRequester(), sessionId: 5, attendeeId: 1 })
    ).rejects.toThrow('Attendee not found for this session');
  });

  it('rejects an unknown attendee', async () => {
    const { sessionRepository } = buildRepos();
    sessionRepository.findAttendeeById.mockResolvedValue(null);
    const useCase = new DeleteAttendeeUseCase({ sessionRepository });

    await expect(
      useCase.execute({ requester: buildRequester(), sessionId: 5, attendeeId: 999 })
    ).rejects.toThrow('Attendee not found for this session');
  });

  it('rejects an attendee who already submitted a survey', async () => {
    const { sessionRepository } = buildRepos();
    sessionRepository.findAttendeeById.mockResolvedValue({ id: 1, sessionId: 5, surveySubmitted: true });
    const useCase = new DeleteAttendeeUseCase({ sessionRepository });

    await expect(
      useCase.execute({ requester: buildRequester(), sessionId: 5, attendeeId: 1 })
    ).rejects.toThrow('already submitted a survey');
    expect(sessionRepository.deleteAttendee).not.toHaveBeenCalled();
  });

  it('deletes the attendee when everything checks out', async () => {
    const { sessionRepository } = buildRepos();
    const useCase = new DeleteAttendeeUseCase({ sessionRepository });

    await useCase.execute({ requester: buildRequester(), sessionId: 5, attendeeId: 1 });

    expect(sessionRepository.deleteAttendee).toHaveBeenCalledWith(1);
  });

  it('allows a SuperAdmin (via canManageCatalog) to delete an attendee', async () => {
    const { sessionRepository } = buildRepos();
    const useCase = new DeleteAttendeeUseCase({ sessionRepository });

    await useCase.execute({
      requester: buildRequester({ canManageCatalog: () => true, isSuperAdmin: () => true }),
      sessionId: 5,
      attendeeId: 1,
    });

    expect(sessionRepository.deleteAttendee).toHaveBeenCalledWith(1);
  });
});
