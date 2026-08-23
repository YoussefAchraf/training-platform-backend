import { CreateTrainingUseCase } from '../../../src/use-cases/trainings/CreateTrainingUseCase';

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
    trainingRepository: {
      create: jest.fn().mockResolvedValue({ id: 5, name: 'RHCSA', createdBy: 1 }),
    },
    providerRepository: {
      findById: jest.fn().mockResolvedValue({ id: 1, name: 'Red Hat' }),
    },
    auditLogRepository: { create: jest.fn() },
  };
}

describe('CreateTrainingUseCase', () => {
  it('rejects a requester who cannot manage the catalog', async () => {
    const { trainingRepository, providerRepository, auditLogRepository } = buildRepos();
    const useCase = new CreateTrainingUseCase({ trainingRepository, providerRepository, auditLogRepository });

    await expect(
      useCase.execute({ requester: buildRequester({ canManageCatalog: () => false }), name: 'RHCSA', providerId: 1 })
    ).rejects.toThrow('Only Sales or Manager');
  });

  it('rejects a missing or blank name', async () => {
    const { trainingRepository, providerRepository, auditLogRepository } = buildRepos();
    const useCase = new CreateTrainingUseCase({ trainingRepository, providerRepository, auditLogRepository });

    await expect(
      useCase.execute({ requester: buildRequester(), name: '   ', providerId: 1 })
    ).rejects.toThrow('Training name is required');
  });

  it('rejects a provider that does not exist', async () => {
    const { trainingRepository, providerRepository, auditLogRepository } = buildRepos();
    providerRepository.findById.mockResolvedValue(null);
    const useCase = new CreateTrainingUseCase({ trainingRepository, providerRepository, auditLogRepository });

    await expect(
      useCase.execute({ requester: buildRequester(), name: 'RHCSA', providerId: 999 })
    ).rejects.toThrow('Provider not found');
  });

  it('rejects a durationUnit that is not "days" or "hours" when duration is set', async () => {
    const { trainingRepository, providerRepository, auditLogRepository } = buildRepos();
    const useCase = new CreateTrainingUseCase({ trainingRepository, providerRepository, auditLogRepository });

    await expect(
      useCase.execute({ requester: buildRequester(), name: 'RHCSA', providerId: 1, duration: 3, durationUnit: 'weeks' })
    ).rejects.toThrow('durationUnit must be "days" or "hours"');
    expect(trainingRepository.create).not.toHaveBeenCalled();
  });

  it('rejects a missing durationUnit when duration is set', async () => {
    const { trainingRepository, providerRepository, auditLogRepository } = buildRepos();
    const useCase = new CreateTrainingUseCase({ trainingRepository, providerRepository, auditLogRepository });

    await expect(
      useCase.execute({ requester: buildRequester(), name: 'RHCSA', providerId: 1, duration: 3 })
    ).rejects.toThrow('durationUnit must be "days" or "hours"');
  });

  it('creates a training with duration/durationUnit and writes an audit log entry', async () => {
    const { trainingRepository, providerRepository, auditLogRepository } = buildRepos();
    const useCase = new CreateTrainingUseCase({ trainingRepository, providerRepository, auditLogRepository });

    await useCase.execute({ requester: buildRequester(), name: 'RHCSA', providerId: 1, duration: 40, durationUnit: 'hours' });

    expect(trainingRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'RHCSA', providerId: 1, duration: 40, durationUnit: 'hours', createdBy: 1 })
    );
    expect(auditLogRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ actorId: 1, action: 'create', entityType: 'Training', entityId: 5 })
    );
  });

  it('creates a training with no duration at all (durationUnit ignored/nulled)', async () => {
    const { trainingRepository, providerRepository, auditLogRepository } = buildRepos();
    const useCase = new CreateTrainingUseCase({ trainingRepository, providerRepository, auditLogRepository });

    await useCase.execute({ requester: buildRequester(), name: 'RHCSA', providerId: 1 });

    expect(trainingRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ duration: undefined, durationUnit: null })
    );
  });
});
