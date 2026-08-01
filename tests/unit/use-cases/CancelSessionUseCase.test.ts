import { CancelSessionUseCase } from '../../../src/use-cases/sessions/CancelSessionUseCase';

function buildRequester(overrides: Record<string, any> = {}) {
  return {
    id: 1,
    canManageCatalog: () => true,
    isSuperAdmin: () => false,
    ...overrides,
  };
}

function buildRepos() {
  const session = { id: 5, createdBy: 1, sessionStatus: 'scheduled' };
  return {
    sessionRepository: {
      findById: jest.fn().mockResolvedValue(session),
      updateSessionStatus: jest.fn().mockResolvedValue({ ...session, sessionStatus: 'cancelled' }),
    },
    reportRepository: { findBySessionId: jest.fn().mockResolvedValue(null) },
    surveyRepository: { listBySession: jest.fn().mockResolvedValue([]) },
    auditLogRepository: { create: jest.fn() },
    session,
  };
}

describe('CancelSessionUseCase', () => {
  it('rejects a requester who cannot manage the catalog and is not SuperAdmin', async () => {
    const { sessionRepository, reportRepository, surveyRepository, auditLogRepository } = buildRepos();
    const useCase = new CancelSessionUseCase({ sessionRepository, reportRepository, surveyRepository, auditLogRepository });

    await expect(
      useCase.execute({ requester: buildRequester({ canManageCatalog: () => false }), sessionId: 5 })
    ).rejects.toThrow('Only Sales or Manager');
  });

  it('rejects a session that does not exist', async () => {
    const { sessionRepository, reportRepository, surveyRepository, auditLogRepository } = buildRepos();
    sessionRepository.findById.mockResolvedValue(null);
    const useCase = new CancelSessionUseCase({ sessionRepository, reportRepository, surveyRepository, auditLogRepository });

    await expect(
      useCase.execute({ requester: buildRequester(), sessionId: 999 })
    ).rejects.toThrow('Training session not found');
  });

  it('rejects a requester who did not create the session', async () => {
    const { sessionRepository, reportRepository, surveyRepository, auditLogRepository } = buildRepos();
    const useCase = new CancelSessionUseCase({ sessionRepository, reportRepository, surveyRepository, auditLogRepository });

    await expect(
      useCase.execute({ requester: buildRequester({ id: 2 }), sessionId: 5 })
    ).rejects.toThrow('You can only cancel a training session you created');
  });

  it('rejects a session that is already cancelled', async () => {
    const { sessionRepository, reportRepository, surveyRepository, auditLogRepository, session } = buildRepos();
    sessionRepository.findById.mockResolvedValue({ ...session, sessionStatus: 'cancelled' });
    const useCase = new CancelSessionUseCase({ sessionRepository, reportRepository, surveyRepository, auditLogRepository });

    await expect(
      useCase.execute({ requester: buildRequester(), sessionId: 5 })
    ).rejects.toThrow('already cancelled');
  });

  it('rejects cancelling a session that already has a report', async () => {
    const { sessionRepository, reportRepository, surveyRepository, auditLogRepository } = buildRepos();
    reportRepository.findBySessionId.mockResolvedValue({ id: 1, sessionId: 5 });
    const useCase = new CancelSessionUseCase({ sessionRepository, reportRepository, surveyRepository, auditLogRepository });

    await expect(
      useCase.execute({ requester: buildRequester(), sessionId: 5 })
    ).rejects.toThrow('already has a survey or report');
  });

  it('allows the creator to cancel and writes an audit log entry', async () => {
    const { sessionRepository, reportRepository, surveyRepository, auditLogRepository } = buildRepos();
    const useCase = new CancelSessionUseCase({ sessionRepository, reportRepository, surveyRepository, auditLogRepository });

    await useCase.execute({ requester: buildRequester(), sessionId: 5 });

    expect(sessionRepository.updateSessionStatus).toHaveBeenCalledWith(5, 'cancelled');
    expect(auditLogRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ actorId: 1, action: 'cancel', entityType: 'Session', entityId: 5 })
    );
  });

  it('allows a SuperAdmin to cancel a session with an existing report, bypassing both ownership and the guard', async () => {
    const { sessionRepository, reportRepository, surveyRepository, auditLogRepository } = buildRepos();
    reportRepository.findBySessionId.mockResolvedValue({ id: 1, sessionId: 5 });
    const useCase = new CancelSessionUseCase({ sessionRepository, reportRepository, surveyRepository, auditLogRepository });

    await expect(
      useCase.execute({
        requester: buildRequester({ id: 99, canManageCatalog: () => false, isSuperAdmin: () => true }),
        sessionId: 5,
      })
    ).resolves.toBeDefined();
  });
});
