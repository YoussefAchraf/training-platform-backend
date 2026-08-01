import { UpdateProviderUseCase } from '../../../src/use-cases/providers/UpdateProviderUseCase';

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
    providerRepository: {
      findById: jest.fn().mockResolvedValue({ id: 5, name: 'Old Name', createdBy: 1 }),
      update: jest.fn().mockResolvedValue({ id: 5, name: 'New Name', createdBy: 1 }),
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

describe('UpdateProviderUseCase', () => {
  it('rejects a requester who cannot manage the catalog and is not SuperAdmin', async () => {
    const { providerRepository, auditLogRepository, userRepository, emailService } = buildRepos();
    const useCase = new UpdateProviderUseCase({ providerRepository, auditLogRepository, userRepository, emailService });

    await expect(
      useCase.execute({ requester: buildRequester({ canManageCatalog: () => false }), providerId: 5, name: 'X' })
    ).rejects.toThrow('Only Sales or Manager');
    expect(providerRepository.findById).not.toHaveBeenCalled();
  });

  it('rejects a provider that does not exist', async () => {
    const { providerRepository, auditLogRepository, userRepository, emailService } = buildRepos();
    providerRepository.findById.mockResolvedValue(null);
    const useCase = new UpdateProviderUseCase({ providerRepository, auditLogRepository, userRepository, emailService });

    await expect(
      useCase.execute({ requester: buildRequester(), providerId: 999, name: 'X' })
    ).rejects.toThrow('Provider not found');
  });

  it('rejects a requester who did not create the provider', async () => {
    const { providerRepository, auditLogRepository, userRepository, emailService } = buildRepos();
    const useCase = new UpdateProviderUseCase({ providerRepository, auditLogRepository, userRepository, emailService });

    await expect(
      useCase.execute({ requester: buildRequester({ id: 2 }), providerId: 5, name: 'X' })
    ).rejects.toThrow('You can only update a provider you created');
    expect(providerRepository.update).not.toHaveBeenCalled();
  });

  it('allows the creator to update and writes an audit log entry', async () => {
    const { providerRepository, auditLogRepository, userRepository, emailService } = buildRepos();
    const useCase = new UpdateProviderUseCase({ providerRepository, auditLogRepository, userRepository, emailService });

    const result = await useCase.execute({ requester: buildRequester(), providerId: 5, name: 'New Name' });

    expect(result).toEqual({ id: 5, name: 'New Name', createdBy: 1 });
    expect(auditLogRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ actorId: 1, action: 'update', entityType: 'Provider', entityId: 5 })
    );
  });

  it('allows a SuperAdmin to update a provider they did not create', async () => {
    const { providerRepository, auditLogRepository, userRepository, emailService } = buildRepos();
    const useCase = new UpdateProviderUseCase({ providerRepository, auditLogRepository, userRepository, emailService });

    await expect(
      useCase.execute({
        requester: buildRequester({ id: 99, canManageCatalog: () => false, isSuperAdmin: () => true }),
        providerId: 5,
        name: 'New Name',
      })
    ).resolves.toBeDefined();
    expect(providerRepository.update).toHaveBeenCalled();
  });

  it('notifies approved managers except the acting user', async () => {
    const { providerRepository, auditLogRepository, userRepository, emailService } = buildRepos();
    const useCase = new UpdateProviderUseCase({ providerRepository, auditLogRepository, userRepository, emailService });

    await useCase.execute({ requester: buildRequester(), providerId: 5, name: 'New Name' });

    expect(emailService.sendRecordChangedNotification).toHaveBeenCalledWith(
      ['other-manager@example.com'],
      expect.objectContaining({ action: 'update', entityType: 'Provider', entityId: 5, label: 'New Name' })
    );
  });

  it('still returns the updated provider even if sending the manager notification fails', async () => {
    const { providerRepository, auditLogRepository, userRepository, emailService } = buildRepos();
    emailService.sendRecordChangedNotification.mockRejectedValue(new Error('connect ECONNREFUSED'));
    const useCase = new UpdateProviderUseCase({ providerRepository, auditLogRepository, userRepository, emailService });

    await expect(
      useCase.execute({ requester: buildRequester(), providerId: 5, name: 'New Name' })
    ).resolves.toEqual({ id: 5, name: 'New Name', createdBy: 1 });
  });
});
