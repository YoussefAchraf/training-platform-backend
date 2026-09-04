import { UpdateClientUseCase } from '../../../src/use-cases/clients/UpdateClientUseCase';

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
      update: jest.fn().mockResolvedValue({ id: 5, companyName: 'New Co', createdBy: 1 }),
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

describe('UpdateClientUseCase', () => {
  it('rejects a requester who cannot manage the catalog and is not SuperAdmin', async () => {
    const { clientRepository, auditLogRepository, userRepository, emailService } = buildRepos();
    const useCase = new UpdateClientUseCase({ clientRepository, auditLogRepository, userRepository, emailService });

    await expect(
      useCase.execute({ requester: buildRequester({ canManageCatalog: () => false }), clientId: 5, companyName: 'X' })
    ).rejects.toThrow('Only Sales or Manager');
  });

  it('rejects a malformed email address before looking up the client', async () => {
    const { clientRepository, auditLogRepository, userRepository, emailService } = buildRepos();
    const useCase = new UpdateClientUseCase({ clientRepository, auditLogRepository, userRepository, emailService });

    await expect(
      useCase.execute({ requester: buildRequester(), clientId: 5, email: 'not-an-email' })
    ).rejects.toThrow('valid email');
    expect(clientRepository.findById).not.toHaveBeenCalled();
  });

  it('rejects a client that does not exist', async () => {
    const { clientRepository, auditLogRepository, userRepository, emailService } = buildRepos();
    clientRepository.findById.mockResolvedValue(null);
    const useCase = new UpdateClientUseCase({ clientRepository, auditLogRepository, userRepository, emailService });

    await expect(
      useCase.execute({ requester: buildRequester(), clientId: 999, companyName: 'X' })
    ).rejects.toThrow('Client not found');
  });

  it('rejects a requester who did not create the client', async () => {
    const { clientRepository, auditLogRepository, userRepository, emailService } = buildRepos();
    const useCase = new UpdateClientUseCase({ clientRepository, auditLogRepository, userRepository, emailService });

    await expect(
      useCase.execute({ requester: buildRequester({ id: 2 }), clientId: 5, companyName: 'X' })
    ).rejects.toThrow('You can only update a client you created');
    expect(clientRepository.update).not.toHaveBeenCalled();
  });

  it('allows the creator to update and writes an audit log entry', async () => {
    const { clientRepository, auditLogRepository, userRepository, emailService } = buildRepos();
    const useCase = new UpdateClientUseCase({ clientRepository, auditLogRepository, userRepository, emailService });

    await useCase.execute({ requester: buildRequester(), clientId: 5, companyName: 'New Co' });

    expect(auditLogRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ actorId: 1, action: 'update', entityType: 'Client', entityId: 5 })
    );
  });

  it('allows a SuperAdmin to update a client they did not create', async () => {
    const { clientRepository, auditLogRepository, userRepository, emailService } = buildRepos();
    const useCase = new UpdateClientUseCase({ clientRepository, auditLogRepository, userRepository, emailService });

    await expect(
      useCase.execute({
        requester: buildRequester({ id: 99, canManageCatalog: () => false, isSuperAdmin: () => true }),
        clientId: 5,
        companyName: 'New Co',
      })
    ).resolves.toBeDefined();
  });

  it('notifies approved managers except the acting user', async () => {
    const { clientRepository, auditLogRepository, userRepository, emailService } = buildRepos();
    const useCase = new UpdateClientUseCase({ clientRepository, auditLogRepository, userRepository, emailService });

    await useCase.execute({ requester: buildRequester(), clientId: 5, companyName: 'New Co' });

    expect(emailService.sendRecordChangedNotification).toHaveBeenCalledWith(
      ['other-manager@example.com'],
      expect.objectContaining({ action: 'update', entityType: 'Client', entityId: 5, label: 'New Co' })
    );
  });

  it('still returns the updated client even if sending the manager notification fails', async () => {
    const { clientRepository, auditLogRepository, userRepository, emailService } = buildRepos();
    emailService.sendRecordChangedNotification.mockRejectedValue(new Error('connect ECONNREFUSED'));
    const useCase = new UpdateClientUseCase({ clientRepository, auditLogRepository, userRepository, emailService });

    await expect(
      useCase.execute({ requester: buildRequester(), clientId: 5, companyName: 'New Co' })
    ).resolves.toBeDefined();
  });

  it('rejects a country that is not a real ISO 3166-1 alpha-2 code', async () => {
    const { clientRepository, auditLogRepository, userRepository, emailService } = buildRepos();
    const useCase = new UpdateClientUseCase({ clientRepository, auditLogRepository, userRepository, emailService });

    await expect(
      useCase.execute({ requester: buildRequester(), clientId: 5, country: 'ZZ' })
    ).rejects.toThrow('valid ISO 3166-1');
    expect(clientRepository.findById).not.toHaveBeenCalled();
  });

  it('rejects a phone number invalid for the newly-submitted country', async () => {
    const { clientRepository, auditLogRepository, userRepository, emailService } = buildRepos();
    const useCase = new UpdateClientUseCase({ clientRepository, auditLogRepository, userRepository, emailService });

    await expect(
      useCase.execute({ requester: buildRequester(), clientId: 5, country: 'TN', phone: '123' })
    ).rejects.toThrow('not a valid number for TN');
    expect(clientRepository.update).not.toHaveBeenCalled();
  });

  it("falls back to the client's already-stored country when only the phone is being changed", async () => {
    const { clientRepository, auditLogRepository, userRepository, emailService } = buildRepos();
    clientRepository.findById.mockResolvedValue({ id: 5, companyName: 'Old Co', createdBy: 1, country: 'TN' });
    const useCase = new UpdateClientUseCase({ clientRepository, auditLogRepository, userRepository, emailService });

    await expect(
      useCase.execute({ requester: buildRequester(), clientId: 5, phone: '123' })
    ).rejects.toThrow('not a valid number for TN');

    await useCase.execute({ requester: buildRequester(), clientId: 5, phone: '+21620123456' });
    expect(clientRepository.update).toHaveBeenCalledWith(5, expect.objectContaining({ phone: '+21620123456' }));
  });
});
