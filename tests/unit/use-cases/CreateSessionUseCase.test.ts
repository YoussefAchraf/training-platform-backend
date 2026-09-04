import { CreateSessionUseCase } from '../../../src/use-cases/sessions/CreateSessionUseCase';

function buildRequester(overrides: Record<string, any> = {}) {
  return {
    id: 1,
    email: 'actor@example.com',
    canManageCatalog: () => true,
    ...overrides,
  };
}

function buildRepos() {
  return {
    sessionRepository: {
      create: jest.fn().mockResolvedValue({ id: 5, trainingId: 1, clientId: 1 }),
      findConflictingSessionForTraining: jest.fn().mockResolvedValue(null),
    },
    trainingRepository: {
      findById: jest.fn().mockResolvedValue({ id: 1, name: 'RHCSA' }),
    },
    clientRepository: {
      findById: jest.fn().mockResolvedValue({ id: 1, companyName: 'Acme Corp' }),
    },
    calendarRepository: { create: jest.fn() },
    auditLogRepository: { create: jest.fn() },
  };
}

describe('CreateSessionUseCase', () => {
  it('rejects a requester who cannot manage the catalog', async () => {
    const { sessionRepository, trainingRepository, clientRepository, calendarRepository, auditLogRepository } = buildRepos();
    const useCase = new CreateSessionUseCase({ sessionRepository, trainingRepository, clientRepository, calendarRepository, auditLogRepository });

    await expect(
      useCase.execute({
        requester: buildRequester({ canManageCatalog: () => false }),
        trainingId: 1,
        clientId: 1,
        startDate: '2026-09-01T09:00:00Z',
        endDate: '2026-09-01T17:00:00Z',
      })
    ).rejects.toThrow('Only Sales or Manager');
  });

  it('rejects an endDate that is not after startDate', async () => {
    const { sessionRepository, trainingRepository, clientRepository, calendarRepository, auditLogRepository } = buildRepos();
    const useCase = new CreateSessionUseCase({ sessionRepository, trainingRepository, clientRepository, calendarRepository, auditLogRepository });

    await expect(
      useCase.execute({
        requester: buildRequester(),
        trainingId: 1,
        clientId: 1,
        startDate: '2026-09-01T09:00:00Z',
        endDate: '2026-09-01T08:00:00Z',
      })
    ).rejects.toThrow('endDate must be after startDate');
  });

  it('creates the session and a matching calendar row carrying both start and end dates', async () => {
    const { sessionRepository, trainingRepository, clientRepository, calendarRepository, auditLogRepository } = buildRepos();
    const useCase = new CreateSessionUseCase({ sessionRepository, trainingRepository, clientRepository, calendarRepository, auditLogRepository });

    await useCase.execute({
      requester: buildRequester(),
      trainingId: 1,
      clientId: 1,
      startDate: '2026-09-01T09:00:00Z',
      endDate: '2026-09-03T17:00:00Z',
    });

    expect(calendarRepository.create).toHaveBeenCalledWith({
      sessionId: 5,
      eventDate: '2026-09-01T09:00:00Z',
      endDate: '2026-09-03T17:00:00Z',
      title: 'RHCSA - Acme Corp',
    });
    expect(auditLogRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ actorId: 1, action: 'create', entityType: 'Session', entityId: 5 })
    );
  });

  it('defaults includeWeekends to false and passes it through to the repository', async () => {
    const { sessionRepository, trainingRepository, clientRepository, calendarRepository, auditLogRepository } = buildRepos();
    const useCase = new CreateSessionUseCase({ sessionRepository, trainingRepository, clientRepository, calendarRepository, auditLogRepository });

    await useCase.execute({
      requester: buildRequester(),
      trainingId: 1,
      clientId: 1,
      startDate: '2026-09-01T09:00:00Z',
      endDate: '2026-09-03T17:00:00Z',
    });

    expect(sessionRepository.create).toHaveBeenCalledWith(expect.objectContaining({ includeWeekends: false }));

    await useCase.execute({
      requester: buildRequester(),
      trainingId: 1,
      clientId: 1,
      startDate: '2026-09-01T09:00:00Z',
      endDate: '2026-09-03T17:00:00Z',
      includeWeekends: true,
    });

    expect(sessionRepository.create).toHaveBeenCalledWith(expect.objectContaining({ includeWeekends: true }));
  });

  it('defaults locationType to onsite and passes it through to the repository', async () => {
    const { sessionRepository, trainingRepository, clientRepository, calendarRepository, auditLogRepository } = buildRepos();
    const useCase = new CreateSessionUseCase({ sessionRepository, trainingRepository, clientRepository, calendarRepository, auditLogRepository });

    await useCase.execute({
      requester: buildRequester(),
      trainingId: 1,
      clientId: 1,
      startDate: '2026-09-01T09:00:00Z',
      endDate: '2026-09-03T17:00:00Z',
    });

    expect(sessionRepository.create).toHaveBeenCalledWith(expect.objectContaining({ locationType: 'onsite' }));

    await useCase.execute({
      requester: buildRequester(),
      trainingId: 1,
      clientId: 1,
      startDate: '2026-09-01T09:00:00Z',
      endDate: '2026-09-03T17:00:00Z',
      locationType: 'remote',
    });

    expect(sessionRepository.create).toHaveBeenCalledWith(expect.objectContaining({ locationType: 'remote' }));
  });

  it('rejects an invalid locationType', async () => {
    const { sessionRepository, trainingRepository, clientRepository, calendarRepository, auditLogRepository } = buildRepos();
    const useCase = new CreateSessionUseCase({ sessionRepository, trainingRepository, clientRepository, calendarRepository, auditLogRepository });

    await expect(
      useCase.execute({
        requester: buildRequester(),
        trainingId: 1,
        clientId: 1,
        startDate: '2026-09-01T09:00:00Z',
        endDate: '2026-09-01T17:00:00Z',
        locationType: 'hybrid',
      })
    ).rejects.toThrow('locationType must be one of');
    expect(sessionRepository.create).not.toHaveBeenCalled();
  });

  it('rejects when another session for the same training already starts at the exact same time', async () => {
    const { sessionRepository, trainingRepository, clientRepository, calendarRepository, auditLogRepository } = buildRepos();
    sessionRepository.findConflictingSessionForTraining.mockResolvedValue({ id: 9, trainingId: 1 });
    const useCase = new CreateSessionUseCase({ sessionRepository, trainingRepository, clientRepository, calendarRepository, auditLogRepository });

    await expect(
      useCase.execute({
        requester: buildRequester(),
        trainingId: 1,
        clientId: 1,
        startDate: '2026-09-01T09:00:00Z',
        endDate: '2026-09-01T17:00:00Z',
      })
    ).rejects.toThrow('already starts at the exact same time');
    expect(sessionRepository.create).not.toHaveBeenCalled();
  });

  it('allows the same training to run again on the same day at a different time', async () => {
    const { sessionRepository, trainingRepository, clientRepository, calendarRepository, auditLogRepository } = buildRepos();
    const useCase = new CreateSessionUseCase({ sessionRepository, trainingRepository, clientRepository, calendarRepository, auditLogRepository });

    await expect(
      useCase.execute({
        requester: buildRequester(),
        trainingId: 1,
        clientId: 1,
        startDate: '2026-09-01T13:00:00Z',
        endDate: '2026-09-01T17:00:00Z',
      })
    ).resolves.toBeDefined();
    expect(sessionRepository.findConflictingSessionForTraining).toHaveBeenCalledWith(1, '2026-09-01T13:00:00Z');
  });
});
