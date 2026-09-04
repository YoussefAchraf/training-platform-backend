import { UpdateSessionUseCase } from '../../../src/use-cases/sessions/UpdateSessionUseCase';

function buildRequester(overrides: Record<string, any> = {}) {
  return {
    id: 1,
    email: 'actor@example.com',
    firstname: 'Actor',
    lastname: 'Person',
    canManageCatalog: () => true,
    isSuperAdmin: () => false,
    ...overrides,
  };
}

function buildRepos() {
  const session = {
    id: 5,
    createdBy: 1,
    startDate: '2026-09-01T09:00:00Z',
    endDate: '2026-09-01T17:00:00Z',
  };
  return {
    sessionRepository: {
      findById: jest.fn().mockResolvedValue(session),
      update: jest.fn().mockResolvedValue({ ...session, startDate: '2026-09-02T09:00:00Z' }),
    },
    calendarRepository: { updateBySessionId: jest.fn() },
    reportRepository: { findBySessionId: jest.fn().mockResolvedValue(null) },
    surveyRepository: { listBySession: jest.fn().mockResolvedValue([]) },
    auditLogRepository: { create: jest.fn() },
    userRepository: {
      listApprovedManagers: jest.fn().mockResolvedValue([
        { email: 'actor@example.com' },
        { email: 'other-manager@example.com' },
      ]),
    },
    emailService: { sendRecordChangedNotification: jest.fn() },
    session,
  };
}

describe('UpdateSessionUseCase', () => {
  it('rejects a requester who cannot manage the catalog and is not SuperAdmin', async () => {
    const { sessionRepository, calendarRepository, reportRepository, surveyRepository, auditLogRepository, userRepository, emailService } = buildRepos();
    const useCase = new UpdateSessionUseCase({ sessionRepository, calendarRepository, reportRepository, surveyRepository, auditLogRepository, userRepository, emailService });

    await expect(
      useCase.execute({ requester: buildRequester({ canManageCatalog: () => false }), sessionId: 5 })
    ).rejects.toThrow('Only Sales or Manager');
  });

  it('rejects a session that does not exist', async () => {
    const { sessionRepository, calendarRepository, reportRepository, surveyRepository, auditLogRepository, userRepository, emailService } = buildRepos();
    sessionRepository.findById.mockResolvedValue(null);
    const useCase = new UpdateSessionUseCase({ sessionRepository, calendarRepository, reportRepository, surveyRepository, auditLogRepository, userRepository, emailService });

    await expect(
      useCase.execute({ requester: buildRequester(), sessionId: 999 })
    ).rejects.toThrow('Training session not found');
  });

  it('rejects a requester who did not create the session', async () => {
    const { sessionRepository, calendarRepository, reportRepository, surveyRepository, auditLogRepository, userRepository, emailService } = buildRepos();
    const useCase = new UpdateSessionUseCase({ sessionRepository, calendarRepository, reportRepository, surveyRepository, auditLogRepository, userRepository, emailService });

    await expect(
      useCase.execute({ requester: buildRequester({ id: 2 }), sessionId: 5 })
    ).rejects.toThrow('You can only update a training session you created');
  });

  it('rejects editing a session that already has a report', async () => {
    const { sessionRepository, calendarRepository, reportRepository, surveyRepository, auditLogRepository, userRepository, emailService } = buildRepos();
    reportRepository.findBySessionId.mockResolvedValue({ id: 1, sessionId: 5 });
    const useCase = new UpdateSessionUseCase({ sessionRepository, calendarRepository, reportRepository, surveyRepository, auditLogRepository, userRepository, emailService });

    await expect(
      useCase.execute({ requester: buildRequester(), sessionId: 5, startDate: '2026-09-02T09:00:00Z' })
    ).rejects.toThrow('already has a survey or report');
  });

  it('rejects editing a session that already has a survey', async () => {
    const { sessionRepository, calendarRepository, reportRepository, surveyRepository, auditLogRepository, userRepository, emailService } = buildRepos();
    surveyRepository.listBySession.mockResolvedValue([{ id: 1 }]);
    const useCase = new UpdateSessionUseCase({ sessionRepository, calendarRepository, reportRepository, surveyRepository, auditLogRepository, userRepository, emailService });

    await expect(
      useCase.execute({ requester: buildRequester(), sessionId: 5, startDate: '2026-09-02T09:00:00Z' })
    ).rejects.toThrow('already has a survey or report');
  });

  it('rejects an endDate that is not after startDate', async () => {
    const { sessionRepository, calendarRepository, reportRepository, surveyRepository, auditLogRepository, userRepository, emailService } = buildRepos();
    const useCase = new UpdateSessionUseCase({ sessionRepository, calendarRepository, reportRepository, surveyRepository, auditLogRepository, userRepository, emailService });

    await expect(
      useCase.execute({
        requester: buildRequester(),
        sessionId: 5,
        startDate: '2026-09-01T09:00:00Z',
        endDate: '2026-09-01T08:00:00Z',
      })
    ).rejects.toThrow('endDate must be after startDate');
  });

  it('allows the creator to update dates and writes an audit log entry', async () => {
    const { sessionRepository, calendarRepository, reportRepository, surveyRepository, auditLogRepository, userRepository, emailService } = buildRepos();
    const useCase = new UpdateSessionUseCase({ sessionRepository, calendarRepository, reportRepository, surveyRepository, auditLogRepository, userRepository, emailService });

    await useCase.execute({ requester: buildRequester(), sessionId: 5, startDate: '2026-09-01T10:00:00Z' });

    expect(sessionRepository.update).toHaveBeenCalledWith(5, { startDate: '2026-09-01T10:00:00Z', endDate: undefined });
    expect(auditLogRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ actorId: 1, action: 'update', entityType: 'Session', entityId: 5 })
    );
  });

  it('keeps the calendar row in sync with the resolved start/end dates', async () => {
    const { sessionRepository, calendarRepository, reportRepository, surveyRepository, auditLogRepository, userRepository, emailService } = buildRepos();
    const useCase = new UpdateSessionUseCase({ sessionRepository, calendarRepository, reportRepository, surveyRepository, auditLogRepository, userRepository, emailService });

    await useCase.execute({ requester: buildRequester(), sessionId: 5, startDate: '2026-09-01T10:00:00Z' });

    
    
    expect(calendarRepository.updateBySessionId).toHaveBeenCalledWith(5, {
      eventDate: '2026-09-01T10:00:00Z',
      endDate: '2026-09-01T17:00:00Z',
    });
  });

  it('syncs the calendar row using both dates when both are provided', async () => {
    const { sessionRepository, calendarRepository, reportRepository, surveyRepository, auditLogRepository, userRepository, emailService } = buildRepos();
    const useCase = new UpdateSessionUseCase({ sessionRepository, calendarRepository, reportRepository, surveyRepository, auditLogRepository, userRepository, emailService });

    await useCase.execute({
      requester: buildRequester(),
      sessionId: 5,
      startDate: '2026-09-03T09:00:00Z',
      endDate: '2026-09-05T09:00:00Z',
    });

    expect(calendarRepository.updateBySessionId).toHaveBeenCalledWith(5, {
      eventDate: '2026-09-03T09:00:00Z',
      endDate: '2026-09-05T09:00:00Z',
    });
  });

  it('passes includeWeekends through to the repository when provided', async () => {
    const { sessionRepository, calendarRepository, reportRepository, surveyRepository, auditLogRepository, userRepository, emailService } = buildRepos();
    const useCase = new UpdateSessionUseCase({ sessionRepository, calendarRepository, reportRepository, surveyRepository, auditLogRepository, userRepository, emailService });

    await useCase.execute({ requester: buildRequester(), sessionId: 5, startDate: '2026-09-01T10:00:00Z', includeWeekends: true });

    expect(sessionRepository.update).toHaveBeenCalledWith(5, { startDate: '2026-09-01T10:00:00Z', endDate: undefined, includeWeekends: true });
  });

  it('passes locationType through to the repository when provided', async () => {
    const { sessionRepository, calendarRepository, reportRepository, surveyRepository, auditLogRepository, userRepository, emailService } = buildRepos();
    const useCase = new UpdateSessionUseCase({ sessionRepository, calendarRepository, reportRepository, surveyRepository, auditLogRepository, userRepository, emailService });

    await useCase.execute({ requester: buildRequester(), sessionId: 5, locationType: 'remote' });

    expect(sessionRepository.update).toHaveBeenCalledWith(5, expect.objectContaining({ locationType: 'remote' }));
  });

  it('rejects an invalid locationType', async () => {
    const { sessionRepository, calendarRepository, reportRepository, surveyRepository, auditLogRepository, userRepository, emailService } = buildRepos();
    const useCase = new UpdateSessionUseCase({ sessionRepository, calendarRepository, reportRepository, surveyRepository, auditLogRepository, userRepository, emailService });

    await expect(
      useCase.execute({ requester: buildRequester(), sessionId: 5, locationType: 'hybrid' })
    ).rejects.toThrow('locationType must be one of');
    expect(sessionRepository.update).not.toHaveBeenCalled();
  });

  it('allows a SuperAdmin to edit a session with an existing report, bypassing both ownership and the guard', async () => {
    const { sessionRepository, calendarRepository, reportRepository, surveyRepository, auditLogRepository, userRepository, emailService } = buildRepos();
    reportRepository.findBySessionId.mockResolvedValue({ id: 1, sessionId: 5 });
    const useCase = new UpdateSessionUseCase({ sessionRepository, calendarRepository, reportRepository, surveyRepository, auditLogRepository, userRepository, emailService });

    await expect(
      useCase.execute({
        requester: buildRequester({ id: 99, canManageCatalog: () => false, isSuperAdmin: () => true }),
        sessionId: 5,
        startDate: '2026-09-01T10:00:00Z',
      })
    ).resolves.toBeDefined();
  });

  it('notifies approved managers except the acting user', async () => {
    const { sessionRepository, calendarRepository, reportRepository, surveyRepository, auditLogRepository, userRepository, emailService } = buildRepos();
    const useCase = new UpdateSessionUseCase({ sessionRepository, calendarRepository, reportRepository, surveyRepository, auditLogRepository, userRepository, emailService });

    await useCase.execute({ requester: buildRequester(), sessionId: 5, startDate: '2026-09-01T10:00:00Z' });

    expect(emailService.sendRecordChangedNotification).toHaveBeenCalledWith(
      ['other-manager@example.com'],
      expect.objectContaining({ action: 'update', entityType: 'Session', entityId: 5 })
    );
  });

  it('still returns the updated session even if sending the manager notification fails', async () => {
    const { sessionRepository, calendarRepository, reportRepository, surveyRepository, auditLogRepository, userRepository, emailService } = buildRepos();
    emailService.sendRecordChangedNotification.mockRejectedValue(new Error('connect ECONNREFUSED'));
    const useCase = new UpdateSessionUseCase({ sessionRepository, calendarRepository, reportRepository, surveyRepository, auditLogRepository, userRepository, emailService });

    await expect(
      useCase.execute({ requester: buildRequester(), sessionId: 5, startDate: '2026-09-01T10:00:00Z' })
    ).resolves.toBeDefined();
  });
});
