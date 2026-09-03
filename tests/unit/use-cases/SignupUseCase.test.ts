import { SignupUseCase } from '../../../src/use-cases/auth/SignupUseCase';

function buildRepos(overrides: Record<string, any> = {}) {
  const createdUser = {
    id: 10,
    firstname: 'Jane',
    lastname: 'Doe',
    email: 'jane@example.com',
    toSafeJSON: () => ({ id: 10, email: 'jane@example.com', role: 'Sales', status: 'pending' }),
  };

  const userRepository = {
    findByEmail: jest.fn().mockResolvedValue(null),
    findRoleByName: jest.fn().mockResolvedValue({ id: 1 }),
    create: jest.fn().mockResolvedValue(createdUser),
    listApprovedManagers: jest.fn().mockResolvedValue([]),
    ...overrides.userRepository,
  };

  return {
    userRepository,
    instructorRepository: { create: jest.fn(), ...overrides.instructorRepository },
    passwordHasher: { hash: jest.fn().mockResolvedValue('hashed-password'), ...overrides.passwordHasher },
    emailService: { sendNewSignupNotification: jest.fn(), ...overrides.emailService },
    auditLogRepository: { create: jest.fn(), ...overrides.auditLogRepository },
    pushSubscriptionRepository: {
      listByUserId: jest.fn().mockResolvedValue([]),
      deleteByEndpointForUser: jest.fn().mockResolvedValue(undefined),
      ...overrides.pushSubscriptionRepository,
    },
    webPushService: { send: jest.fn().mockResolvedValue(undefined), ...overrides.webPushService },
    createdUser,
  };
}

describe('SignupUseCase', () => {
  it('rejects an unknown role before touching any repository', async () => {
    const repos = buildRepos();
    const useCase = new SignupUseCase(repos);

    await expect(
      useCase.execute({ firstname: 'A', lastname: 'B', email: 'a@b.com', password: 'x', role: 'NotARole' })
    ).rejects.toThrow('role must be one of');

    expect(repos.userRepository.findByEmail).not.toHaveBeenCalled();
  });

  it('rejects SuperAdmin as a self-signup role - it is a real ROLES value but not self-signup-able', async () => {
    const repos = buildRepos();
    const useCase = new SignupUseCase(repos);

    await expect(
      useCase.execute({ firstname: 'A', lastname: 'B', email: 'a@b.com', password: 'x', role: 'SuperAdmin' })
    ).rejects.toThrow('role must be one of');

    expect(repos.userRepository.findByEmail).not.toHaveBeenCalled();
  });

  it('rejects a malformed email address before touching any repository', async () => {
    const repos = buildRepos();
    const useCase = new SignupUseCase(repos);

    await expect(
      useCase.execute({ firstname: 'A', lastname: 'B', email: 'not-an-email', password: 'x', role: 'Sales' })
    ).rejects.toThrow('valid email');

    expect(repos.userRepository.findByEmail).not.toHaveBeenCalled();
  });

  it('rejects a duplicate email', async () => {
    const repos = buildRepos({ userRepository: { findByEmail: jest.fn().mockResolvedValue({ id: 1 }) } });
    const useCase = new SignupUseCase(repos);

    await expect(
      useCase.execute({ firstname: 'A', lastname: 'B', email: 'a@b.com', password: 'x', role: 'Sales' })
    ).rejects.toThrow('already exists');
  });

  it('writes an audit log entry attributed to the newly created user', async () => {
    const repos = buildRepos();
    const useCase = new SignupUseCase(repos);

    await useCase.execute({
      firstname: 'Jane',
      lastname: 'Doe',
      email: 'jane@example.com',
      password: 'password123',
      role: 'Sales',
    });

    expect(repos.auditLogRepository.create).toHaveBeenCalledWith({
      actorId: repos.createdUser.id,
      action: 'create',
      entityType: 'User',
      entityId: repos.createdUser.id,
      after: repos.createdUser.toSafeJSON(),
    });
    expect(repos.instructorRepository.create).not.toHaveBeenCalled();
  });

  it('also creates an instructor profile when signing up as Instructor', async () => {
    const repos = buildRepos();
    const useCase = new SignupUseCase(repos);

    await useCase.execute({
      firstname: 'Jane',
      lastname: 'Doe',
      email: 'jane@example.com',
      password: 'password123',
      role: 'Instructor',
    });

    expect(repos.instructorRepository.create).toHaveBeenCalledWith({ userId: 10, bio: '' });
  });

  it('still returns the created user even if sending the new-signup notification fails', async () => {
    const repos = buildRepos({
      userRepository: { listApprovedManagers: jest.fn().mockResolvedValue([{ id: 7, email: 'manager@example.com' }]) },
      emailService: { sendNewSignupNotification: jest.fn().mockRejectedValue(new Error('connect ECONNREFUSED')) },
    });
    const useCase = new SignupUseCase(repos);

    await expect(
      useCase.execute({ firstname: 'Jane', lastname: 'Doe', email: 'jane@example.com', password: 'password123', role: 'Sales' })
    ).resolves.toEqual(repos.createdUser.toSafeJSON());
  });

  describe('notifying approved managers', () => {
    it('sends a push notification to every device every approved manager is subscribed on', async () => {
      const repos = buildRepos({
        userRepository: {
          listApprovedManagers: jest.fn().mockResolvedValue([
            { id: 7, email: 'manager-a@example.com' },
            { id: 8, email: 'manager-b@example.com' },
          ]),
        },
        pushSubscriptionRepository: {
          listByUserId: jest.fn((userId: number) =>
            Promise.resolve(
              userId === 7
                ? [{ endpoint: 'https://push.example/a', p256dh: 'k', auth: 'a' }]
                : [{ endpoint: 'https://push.example/b', p256dh: 'k', auth: 'a' }]
            )
          ),
        },
      });
      const useCase = new SignupUseCase(repos);

      await useCase.execute({
        firstname: 'Jane',
        lastname: 'Doe',
        email: 'jane@example.com',
        password: 'password123',
        role: 'Sales',
      });

      expect(repos.pushSubscriptionRepository.listByUserId).toHaveBeenCalledWith(7);
      expect(repos.pushSubscriptionRepository.listByUserId).toHaveBeenCalledWith(8);
      expect(repos.webPushService.send).toHaveBeenCalledTimes(2);
      expect(repos.webPushService.send).toHaveBeenCalledWith(
        expect.objectContaining({ endpoint: 'https://push.example/a' }),
        expect.objectContaining({
          title: expect.any(String),
          body: expect.stringContaining('Jane Doe'),
          url: '/admin/pending-approvals',
        }),
      );
    });

    it('cleans up an expired push subscription without throwing', async () => {
      const repos = buildRepos({
        userRepository: { listApprovedManagers: jest.fn().mockResolvedValue([{ id: 7, email: 'manager@example.com' }]) },
        pushSubscriptionRepository: {
          listByUserId: jest.fn().mockResolvedValue([{ endpoint: 'https://push.example/a', p256dh: 'k', auth: 'a' }]),
        },
        webPushService: { send: jest.fn().mockRejectedValue(Object.assign(new Error('gone'), { expired: true })) },
      });
      const useCase = new SignupUseCase(repos);

      await expect(
        useCase.execute({ firstname: 'Jane', lastname: 'Doe', email: 'jane@example.com', password: 'password123', role: 'Sales' })
      ).resolves.toEqual(repos.createdUser.toSafeJSON());
      expect(repos.pushSubscriptionRepository.deleteByEndpointForUser).toHaveBeenCalledWith(
        'https://push.example/a',
        7,
      );
    });

    it('sends no push at all when there are no approved managers', async () => {
      const repos = buildRepos();
      const useCase = new SignupUseCase(repos);

      await useCase.execute({
        firstname: 'Jane',
        lastname: 'Doe',
        email: 'jane@example.com',
        password: 'password123',
        role: 'Sales',
      });

      expect(repos.pushSubscriptionRepository.listByUserId).not.toHaveBeenCalled();
      expect(repos.webPushService.send).not.toHaveBeenCalled();
    });
  });
});
