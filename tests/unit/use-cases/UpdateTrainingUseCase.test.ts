import { UpdateTrainingUseCase } from '../../../src/use-cases/trainings/UpdateTrainingUseCase';

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
  return {
    trainingRepository: {
      findById: jest.fn().mockResolvedValue({ id: 5, name: 'Old', createdBy: 1 }),
      update: jest.fn().mockResolvedValue({ id: 5, name: 'New', createdBy: 1 }),
    },
    auditLogRepository: { create: jest.fn() },
    userRepository: {
      listApprovedManagers: jest.fn().mockResolvedValue([
        { email: 'actor@example.com' },
        { email: 'other-manager@example.com' },
      ]),
    },
    emailService: { sendRecordChangedNotification: jest.fn() },
  };
}

describe('UpdateTrainingUseCase', () => {
  it('rejects a requester who cannot manage the catalog and is not SuperAdmin', async () => {
    const { trainingRepository, auditLogRepository, userRepository, emailService } = buildRepos();
    const useCase = new UpdateTrainingUseCase({ trainingRepository, auditLogRepository, userRepository, emailService });

    await expect(
      useCase.execute({ requester: buildRequester({ canManageCatalog: () => false }), trainingId: 5, name: 'X' })
    ).rejects.toThrow('Only Sales or Manager');
  });

  it('rejects a training that does not exist', async () => {
    const { trainingRepository, auditLogRepository, userRepository, emailService } = buildRepos();
    trainingRepository.findById.mockResolvedValue(null);
    const useCase = new UpdateTrainingUseCase({ trainingRepository, auditLogRepository, userRepository, emailService });

    await expect(
      useCase.execute({ requester: buildRequester(), trainingId: 999, name: 'X' })
    ).rejects.toThrow('Training not found');
  });

  it('rejects a requester who did not create the training', async () => {
    const { trainingRepository, auditLogRepository, userRepository, emailService } = buildRepos();
    const useCase = new UpdateTrainingUseCase({ trainingRepository, auditLogRepository, userRepository, emailService });

    await expect(
      useCase.execute({ requester: buildRequester({ id: 2 }), trainingId: 5, name: 'X' })
    ).rejects.toThrow('You can only update a training you created');
    expect(trainingRepository.update).not.toHaveBeenCalled();
  });

  it('allows the creator to update and writes an audit log entry', async () => {
    const { trainingRepository, auditLogRepository, userRepository, emailService } = buildRepos();
    const useCase = new UpdateTrainingUseCase({ trainingRepository, auditLogRepository, userRepository, emailService });

    await useCase.execute({ requester: buildRequester(), trainingId: 5, name: 'New' });

    expect(auditLogRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ actorId: 1, action: 'update', entityType: 'Training', entityId: 5 })
    );
  });

  it('allows a SuperAdmin to update a training they did not create', async () => {
    const { trainingRepository, auditLogRepository, userRepository, emailService } = buildRepos();
    const useCase = new UpdateTrainingUseCase({ trainingRepository, auditLogRepository, userRepository, emailService });

    await expect(
      useCase.execute({
        requester: buildRequester({ id: 99, canManageCatalog: () => false, isSuperAdmin: () => true }),
        trainingId: 5,
        name: 'New',
      })
    ).resolves.toBeDefined();
  });

  it('notifies approved managers except the acting user', async () => {
    const { trainingRepository, auditLogRepository, userRepository, emailService } = buildRepos();
    const useCase = new UpdateTrainingUseCase({ trainingRepository, auditLogRepository, userRepository, emailService });

    await useCase.execute({ requester: buildRequester(), trainingId: 5, name: 'New' });

    expect(emailService.sendRecordChangedNotification).toHaveBeenCalledWith(
      ['other-manager@example.com'],
      expect.objectContaining({ action: 'update', entityType: 'Training', entityId: 5, label: 'New' })
    );
  });

  it('still returns the updated training even if sending the manager notification fails', async () => {
    const { trainingRepository, auditLogRepository, userRepository, emailService } = buildRepos();
    emailService.sendRecordChangedNotification.mockRejectedValue(new Error('connect ECONNREFUSED'));
    const useCase = new UpdateTrainingUseCase({ trainingRepository, auditLogRepository, userRepository, emailService });

    await expect(
      useCase.execute({ requester: buildRequester(), trainingId: 5, name: 'New' })
    ).resolves.toBeDefined();
  });
});
