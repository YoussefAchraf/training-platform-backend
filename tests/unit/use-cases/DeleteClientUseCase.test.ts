import { DeleteClientUseCase } from '../../../src/use-cases/clients/DeleteClientUseCase';

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
    clientRepository: {
      findById: jest.fn().mockResolvedValue({ id: 5, companyName: 'Old Co', createdBy: 1 }),
      softDelete: jest.fn().mockResolvedValue({ id: 5, companyName: 'Old Co', createdBy: 1, deletedAt: new Date() }),
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

describe('DeleteClientUseCase', () => {
  it('rejects a requester who cannot manage the catalog and is not SuperAdmin', async () => {
    const { clientRepository, auditLogRepository, userRepository, emailService } = buildRepos();
    const useCase = new DeleteClientUseCase({ clientRepository, auditLogRepository, userRepository, emailService });

    await expect(
      useCase.execute({ requester: buildRequester({ canManageCatalog: () => false }), clientId: 5 })
    ).rejects.toThrow('Only Sales or Manager');
  });

  it('rejects a client that does not exist', async () => {
    const { clientRepository, auditLogRepository, userRepository, emailService } = buildRepos();
    clientRepository.findById.mockResolvedValue(null);
    const useCase = new DeleteClientUseCase({ clientRepository, auditLogRepository, userRepository, emailService });

    await expect(
      useCase.execute({ requester: buildRequester(), clientId: 999 })
    ).rejects.toThrow('Client not found');
  });

  it('rejects a requester who did not create the client', async () => {
    const { clientRepository, auditLogRepository, userRepository, emailService } = buildRepos();
    const useCase = new DeleteClientUseCase({ clientRepository, auditLogRepository, userRepository, emailService });

    await expect(
      useCase.execute({ requester: buildRequester({ id: 2 }), clientId: 5 })
    ).rejects.toThrow('You can only delete a client you created');
    expect(clientRepository.softDelete).not.toHaveBeenCalled();
  });

  it('allows the creator to delete and writes an audit log entry', async () => {
    const { clientRepository, auditLogRepository, userRepository, emailService } = buildRepos();
    const useCase = new DeleteClientUseCase({ clientRepository, auditLogRepository, userRepository, emailService });

    await useCase.execute({ requester: buildRequester(), clientId: 5 });

    expect(clientRepository.softDelete).toHaveBeenCalledWith(5);
    expect(auditLogRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ actorId: 1, action: 'delete', entityType: 'Client', entityId: 5 })
    );
  });

  it('allows a SuperAdmin to delete a client they did not create', async () => {
    const { clientRepository, auditLogRepository, userRepository, emailService } = buildRepos();
    const useCase = new DeleteClientUseCase({ clientRepository, auditLogRepository, userRepository, emailService });

    await expect(
      useCase.execute({
        requester: buildRequester({ id: 99, canManageCatalog: () => false, isSuperAdmin: () => true }),
        clientId: 5,
      })
    ).resolves.toBeDefined();
  });

  it('notifies approved managers except the acting user', async () => {
    const { clientRepository, auditLogRepository, userRepository, emailService } = buildRepos();
    const useCase = new DeleteClientUseCase({ clientRepository, auditLogRepository, userRepository, emailService });

    await useCase.execute({ requester: buildRequester(), clientId: 5 });

    expect(emailService.sendRecordChangedNotification).toHaveBeenCalledWith(
      ['other-manager@example.com'],
      expect.objectContaining({ action: 'delete', entityType: 'Client', entityId: 5, label: 'Old Co' })
    );
  });

  it('still deletes the client even if sending the manager notification fails', async () => {
    const { clientRepository, auditLogRepository, userRepository, emailService } = buildRepos();
    emailService.sendRecordChangedNotification.mockRejectedValue(new Error('connect ECONNREFUSED'));
    const useCase = new DeleteClientUseCase({ clientRepository, auditLogRepository, userRepository, emailService });

    await expect(useCase.execute({ requester: buildRequester(), clientId: 5 })).resolves.toBeDefined();
    expect(clientRepository.softDelete).toHaveBeenCalledWith(5);
  });
});
