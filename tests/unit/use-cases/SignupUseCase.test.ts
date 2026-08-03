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
    createdUser,
  };
}

describe('SignupUseCase', () => {
  it('rejects an unknown role before touching any repository', async () => {
    const { userRepository, instructorRepository, passwordHasher, emailService, auditLogRepository } = buildRepos();
    const useCase = new SignupUseCase({ userRepository, instructorRepository, passwordHasher, emailService, auditLogRepository });

    await expect(
      useCase.execute({ firstname: 'A', lastname: 'B', email: 'a@b.com', password: 'x', role: 'NotARole' })
    ).rejects.toThrow('role must be one of');

    expect(userRepository.findByEmail).not.toHaveBeenCalled();
  });

  it('rejects SuperAdmin as a self-signup role - it is a real ROLES value but not self-signup-able', async () => {
    const { userRepository, instructorRepository, passwordHasher, emailService, auditLogRepository } = buildRepos();
    const useCase = new SignupUseCase({ userRepository, instructorRepository, passwordHasher, emailService, auditLogRepository });

    await expect(
      useCase.execute({ firstname: 'A', lastname: 'B', email: 'a@b.com', password: 'x', role: 'SuperAdmin' })
    ).rejects.toThrow('role must be one of');

    expect(userRepository.findByEmail).not.toHaveBeenCalled();
  });

  it('rejects a malformed email address before touching any repository', async () => {
    const { userRepository, instructorRepository, passwordHasher, emailService, auditLogRepository } = buildRepos();
    const useCase = new SignupUseCase({ userRepository, instructorRepository, passwordHasher, emailService, auditLogRepository });

    await expect(
      useCase.execute({ firstname: 'A', lastname: 'B', email: 'not-an-email', password: 'x', role: 'Sales' })
    ).rejects.toThrow('valid email');

    expect(userRepository.findByEmail).not.toHaveBeenCalled();
  });

  it('rejects a duplicate email', async () => {
    const { userRepository, instructorRepository, passwordHasher, emailService, auditLogRepository } = buildRepos({
      userRepository: { findByEmail: jest.fn().mockResolvedValue({ id: 1 }) },
    });
    const useCase = new SignupUseCase({ userRepository, instructorRepository, passwordHasher, emailService, auditLogRepository });

    await expect(
      useCase.execute({ firstname: 'A', lastname: 'B', email: 'a@b.com', password: 'x', role: 'Sales' })
    ).rejects.toThrow('already exists');
  });

  it('writes an audit log entry attributed to the newly created user', async () => {
    const { userRepository, instructorRepository, passwordHasher, emailService, auditLogRepository, createdUser } =
      buildRepos();
    const useCase = new SignupUseCase({ userRepository, instructorRepository, passwordHasher, emailService, auditLogRepository });

    await useCase.execute({
      firstname: 'Jane',
      lastname: 'Doe',
      email: 'jane@example.com',
      password: 'password123',
      role: 'Sales',
    });

    expect(auditLogRepository.create).toHaveBeenCalledWith({
      actorId: createdUser.id,
      action: 'create',
      entityType: 'User',
      entityId: createdUser.id,
      after: createdUser.toSafeJSON(),
    });
    expect(instructorRepository.create).not.toHaveBeenCalled();
  });

  it('also creates an instructor profile when signing up as Instructor', async () => {
    const { userRepository, instructorRepository, passwordHasher, emailService, auditLogRepository } = buildRepos();
    const useCase = new SignupUseCase({ userRepository, instructorRepository, passwordHasher, emailService, auditLogRepository });

    await useCase.execute({
      firstname: 'Jane',
      lastname: 'Doe',
      email: 'jane@example.com',
      password: 'password123',
      role: 'Instructor',
    });

    expect(instructorRepository.create).toHaveBeenCalledWith({ userId: 10, bio: '' });
  });

  it('still returns the created user even if sending the new-signup notification fails', async () => {
    const { userRepository, instructorRepository, passwordHasher, emailService, auditLogRepository, createdUser } =
      buildRepos({
        userRepository: { listApprovedManagers: jest.fn().mockResolvedValue([{ email: 'manager@example.com' }]) },
        emailService: { sendNewSignupNotification: jest.fn().mockRejectedValue(new Error('connect ECONNREFUSED')) },
      });
    const useCase = new SignupUseCase({ userRepository, instructorRepository, passwordHasher, emailService, auditLogRepository });

    await expect(
      useCase.execute({ firstname: 'Jane', lastname: 'Doe', email: 'jane@example.com', password: 'password123', role: 'Sales' })
    ).resolves.toEqual(createdUser.toSafeJSON());
  });
});
