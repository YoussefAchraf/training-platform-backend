import { UpdateClientUseCase } from '../../../src/use-cases/clients/UpdateClientUseCase';

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
    clientRepository: {
      findById: jest.fn().mockResolvedValue({ id: 5, companyName: 'Old Co', createdBy: 1 }),
      update: jest.fn().mockResolvedValue({ id: 5, companyName: 'New Co', createdBy: 1 }),
    },
    auditLogRepository: { create: jest.fn() },
  };
}

describe('UpdateClientUseCase', () => {
  it('rejects a requester who cannot manage the catalog and is not SuperAdmin', async () => {
    const { clientRepository, auditLogRepository } = buildRepos();
    const useCase = new UpdateClientUseCase({ clientRepository, auditLogRepository });

    await expect(
      useCase.execute({ requester: buildRequester({ canManageCatalog: () => false }), clientId: 5, companyName: 'X' })
    ).rejects.toThrow('Only Sales or Manager');
  });

  it('rejects a client that does not exist', async () => {
    const { clientRepository, auditLogRepository } = buildRepos();
    clientRepository.findById.mockResolvedValue(null);
    const useCase = new UpdateClientUseCase({ clientRepository, auditLogRepository });

    await expect(
      useCase.execute({ requester: buildRequester(), clientId: 999, companyName: 'X' })
    ).rejects.toThrow('Client not found');
  });

  it('rejects a requester who did not create the client', async () => {
    const { clientRepository, auditLogRepository } = buildRepos();
    const useCase = new UpdateClientUseCase({ clientRepository, auditLogRepository });

    await expect(
      useCase.execute({ requester: buildRequester({ id: 2 }), clientId: 5, companyName: 'X' })
    ).rejects.toThrow('You can only update a client you created');
    expect(clientRepository.update).not.toHaveBeenCalled();
  });

  it('allows the creator to update and writes an audit log entry', async () => {
    const { clientRepository, auditLogRepository } = buildRepos();
    const useCase = new UpdateClientUseCase({ clientRepository, auditLogRepository });

    await useCase.execute({ requester: buildRequester(), clientId: 5, companyName: 'New Co' });

    expect(auditLogRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ actorId: 1, action: 'update', entityType: 'Client', entityId: 5 })
    );
  });

  it('allows a SuperAdmin to update a client they did not create', async () => {
    const { clientRepository, auditLogRepository } = buildRepos();
    const useCase = new UpdateClientUseCase({ clientRepository, auditLogRepository });

    await expect(
      useCase.execute({
        requester: buildRequester({ id: 99, canManageCatalog: () => false, isSuperAdmin: () => true }),
        clientId: 5,
        companyName: 'New Co',
      })
    ).resolves.toBeDefined();
  });
});
