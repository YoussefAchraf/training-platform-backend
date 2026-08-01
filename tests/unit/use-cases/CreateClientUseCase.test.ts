import { CreateClientUseCase } from '../../../src/use-cases/clients/CreateClientUseCase';

function buildRequester(overrides: Record<string, any> = {}) {
  return {
    id: 1,
    canManageCatalog: () => true,
    ...overrides,
  };
}

function buildRepos() {
  return {
    clientRepository: {
      create: jest.fn().mockResolvedValue({ id: 5, companyName: 'Acme', email: 'acme@example.com' }),
    },
    auditLogRepository: { create: jest.fn() },
  };
}

describe('CreateClientUseCase', () => {
  it('rejects a requester who cannot manage the catalog', async () => {
    const { clientRepository, auditLogRepository } = buildRepos();
    const useCase = new CreateClientUseCase({ clientRepository, auditLogRepository });

    await expect(
      useCase.execute({ requester: buildRequester({ canManageCatalog: () => false }), companyName: 'Acme' })
    ).rejects.toThrow('Only Sales or Manager');
  });

  it('rejects a missing company name', async () => {
    const { clientRepository, auditLogRepository } = buildRepos();
    const useCase = new CreateClientUseCase({ clientRepository, auditLogRepository });

    await expect(
      useCase.execute({ requester: buildRequester(), companyName: '  ' })
    ).rejects.toThrow('Company name is required');
  });

  it('rejects a malformed email address', async () => {
    const { clientRepository, auditLogRepository } = buildRepos();
    const useCase = new CreateClientUseCase({ clientRepository, auditLogRepository });

    await expect(
      useCase.execute({ requester: buildRequester(), companyName: 'Acme', email: 'not-an-email' })
    ).rejects.toThrow('valid email');
    expect(clientRepository.create).not.toHaveBeenCalled();
  });

  it('allows a missing (optional) email', async () => {
    const { clientRepository, auditLogRepository } = buildRepos();
    const useCase = new CreateClientUseCase({ clientRepository, auditLogRepository });

    await expect(
      useCase.execute({ requester: buildRequester(), companyName: 'Acme' })
    ).resolves.toBeDefined();
  });

  it('creates the client and writes an audit log entry when the email is valid', async () => {
    const { clientRepository, auditLogRepository } = buildRepos();
    const useCase = new CreateClientUseCase({ clientRepository, auditLogRepository });

    await useCase.execute({ requester: buildRequester(), companyName: 'Acme', email: 'acme@example.com' });

    expect(clientRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ companyName: 'Acme', email: 'acme@example.com', createdBy: 1 })
    );
    expect(auditLogRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'create', entityType: 'Client' })
    );
  });
});
