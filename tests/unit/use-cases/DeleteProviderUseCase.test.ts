import { DeleteProviderUseCase } from '../../../src/use-cases/providers/DeleteProviderUseCase';

function buildRequester(overrides: Record<string, any> = {}) {
  return {
    id: 1,
    canManageCatalog: () => true,
    isSuperAdmin: () => false,
    ...overrides,
  };
}

function buildRepos() {
  return {
    providerRepository: {
      findById: jest.fn().mockResolvedValue({ id: 5, name: 'Old Name', createdBy: 1 }),
      softDelete: jest.fn().mockResolvedValue({ id: 5, name: 'Old Name', createdBy: 1, deletedAt: new Date() }),
    },
    auditLogRepository: { create: jest.fn() },
  };
}

describe('DeleteProviderUseCase', () => {
  it('rejects a requester who cannot manage the catalog and is not SuperAdmin', async () => {
    const { providerRepository, auditLogRepository } = buildRepos();
    const useCase = new DeleteProviderUseCase({ providerRepository, auditLogRepository });

    await expect(
      useCase.execute({ requester: buildRequester({ canManageCatalog: () => false }), providerId: 5 })
    ).rejects.toThrow('Only Sales or Manager');
    expect(providerRepository.findById).not.toHaveBeenCalled();
  });

  it('rejects a provider that does not exist', async () => {
    const { providerRepository, auditLogRepository } = buildRepos();
    providerRepository.findById.mockResolvedValue(null);
    const useCase = new DeleteProviderUseCase({ providerRepository, auditLogRepository });

    await expect(
      useCase.execute({ requester: buildRequester(), providerId: 999 })
    ).rejects.toThrow('Provider not found');
  });

  it('rejects a requester who did not create the provider', async () => {
    const { providerRepository, auditLogRepository } = buildRepos();
    const useCase = new DeleteProviderUseCase({ providerRepository, auditLogRepository });

    await expect(
      useCase.execute({ requester: buildRequester({ id: 2 }), providerId: 5 })
    ).rejects.toThrow('You can only delete a provider you created');
    expect(providerRepository.softDelete).not.toHaveBeenCalled();
  });

  it('allows the creator to delete and writes an audit log entry', async () => {
    const { providerRepository, auditLogRepository } = buildRepos();
    const useCase = new DeleteProviderUseCase({ providerRepository, auditLogRepository });

    await useCase.execute({ requester: buildRequester(), providerId: 5 });

    expect(providerRepository.softDelete).toHaveBeenCalledWith(5);
    expect(auditLogRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ actorId: 1, action: 'delete', entityType: 'Provider', entityId: 5 })
    );
  });

  it('allows a SuperAdmin to delete a provider they did not create', async () => {
    const { providerRepository, auditLogRepository } = buildRepos();
    const useCase = new DeleteProviderUseCase({ providerRepository, auditLogRepository });

    await expect(
      useCase.execute({
        requester: buildRequester({ id: 99, canManageCatalog: () => false, isSuperAdmin: () => true }),
        providerId: 5,
      })
    ).resolves.toBeDefined();
    expect(providerRepository.softDelete).toHaveBeenCalled();
  });
});
