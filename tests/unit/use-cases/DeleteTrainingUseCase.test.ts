import { DeleteTrainingUseCase } from '../../../src/use-cases/trainings/DeleteTrainingUseCase';

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
      softDelete: jest.fn().mockResolvedValue({ id: 5, name: 'Old', createdBy: 1, deletedAt: new Date() }),
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

describe('DeleteTrainingUseCase', () => {
  it('rejects a requester who cannot manage the catalog and is not SuperAdmin', async () => {
    const { trainingRepository, auditLogRepository, userRepository, emailService } = buildRepos();
    const useCase = new DeleteTrainingUseCase({ trainingRepository, auditLogRepository, userRepository, emailService });

    await expect(
      useCase.execute({ requester: buildRequester({ canManageCatalog: () => false }), trainingId: 5 })
    ).rejects.toThrow('Only Sales or Manager');
  });

  it('rejects a training that does not exist', async () => {
    const { trainingRepository, auditLogRepository, userRepository, emailService } = buildRepos();
    trainingRepository.findById.mockResolvedValue(null);
    const useCase = new DeleteTrainingUseCase({ trainingRepository, auditLogRepository, userRepository, emailService });

    await expect(
      useCase.execute({ requester: buildRequester(), trainingId: 999 })
    ).rejects.toThrow('Training not found');
  });

  it('rejects a requester who did not create the training', async () => {
    const { trainingRepository, auditLogRepository, userRepository, emailService } = buildRepos();
    const useCase = new DeleteTrainingUseCase({ trainingRepository, auditLogRepository, userRepository, emailService });

    await expect(
      useCase.execute({ requester: buildRequester({ id: 2 }), trainingId: 5 })
    ).rejects.toThrow('You can only delete a training you created');
    expect(trainingRepository.softDelete).not.toHaveBeenCalled();
  });

  it('allows the creator to delete and writes an audit log entry', async () => {
    const { trainingRepository, auditLogRepository, userRepository, emailService } = buildRepos();
    const useCase = new DeleteTrainingUseCase({ trainingRepository, auditLogRepository, userRepository, emailService });

    await useCase.execute({ requester: buildRequester(), trainingId: 5 });

    expect(trainingRepository.softDelete).toHaveBeenCalledWith(5);
    expect(auditLogRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ actorId: 1, action: 'delete', entityType: 'Training', entityId: 5 })
    );
  });

  it('allows a SuperAdmin to delete a training they did not create', async () => {
    const { trainingRepository, auditLogRepository, userRepository, emailService } = buildRepos();
    const useCase = new DeleteTrainingUseCase({ trainingRepository, auditLogRepository, userRepository, emailService });

    await expect(
      useCase.execute({
        requester: buildRequester({ id: 99, canManageCatalog: () => false, isSuperAdmin: () => true }),
        trainingId: 5,
      })
    ).resolves.toBeDefined();
  });

  it('notifies approved managers except the acting user', async () => {
    const { trainingRepository, auditLogRepository, userRepository, emailService } = buildRepos();
    const useCase = new DeleteTrainingUseCase({ trainingRepository, auditLogRepository, userRepository, emailService });

    await useCase.execute({ requester: buildRequester(), trainingId: 5 });

    expect(emailService.sendRecordChangedNotification).toHaveBeenCalledWith(
      ['other-manager@example.com'],
      expect.objectContaining({ action: 'delete', entityType: 'Training', entityId: 5, label: 'Old' })
    );
  });

  it('still deletes the training even if sending the manager notification fails', async () => {
    const { trainingRepository, auditLogRepository, userRepository, emailService } = buildRepos();
    emailService.sendRecordChangedNotification.mockRejectedValue(new Error('connect ECONNREFUSED'));
    const useCase = new DeleteTrainingUseCase({ trainingRepository, auditLogRepository, userRepository, emailService });

    await expect(useCase.execute({ requester: buildRequester(), trainingId: 5 })).resolves.toBeDefined();
    expect(trainingRepository.softDelete).toHaveBeenCalledWith(5);
  });
});
