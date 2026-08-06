import { LoginUseCase } from '../../../src/use-cases/auth/LoginUseCase';

function buildUser(overrides: Record<string, any> = {}) {
  const user = {
    id: 1,
    roleName: 'Sales',
    status: 'approved',
    passwordHash: 'hashed',
    toSafeJSON: () => ({ id: 1, email: 'jane@example.com' }),
    ...overrides,
  };
  return { ...user, isApproved: () => user.status === 'approved' };
}

describe('LoginUseCase', () => {
  it('rejects an unknown email with a generic "Invalid credentials" message', async () => {
    const userRepository = { findByEmail: jest.fn().mockResolvedValue(null) };
    const useCase = new LoginUseCase({
      userRepository,
      passwordHasher: { compare: jest.fn() },
      tokenService: { signAccessToken: jest.fn() },
      refreshTokenStore: { issue: jest.fn() },
    });

    await expect(useCase.execute({ email: 'nobody@example.com', password: 'x' })).rejects.toThrow(
      'Invalid credentials'
    );
  });

  it('rejects a wrong password with the same generic message (no user enumeration)', async () => {
    const userRepository = { findByEmail: jest.fn().mockResolvedValue(buildUser()) };
    const passwordHasher = { compare: jest.fn().mockResolvedValue(false) };
    const useCase = new LoginUseCase({
      userRepository,
      passwordHasher,
      tokenService: { signAccessToken: jest.fn() },
      refreshTokenStore: { issue: jest.fn() },
    });

    await expect(useCase.execute({ email: 'jane@example.com', password: 'wrong' })).rejects.toThrow(
      'Invalid credentials'
    );
  });

  it('rejects a pending account', async () => {
    const userRepository = {
      findByEmail: jest.fn().mockResolvedValue(buildUser({ status: 'pending' })),
    };
    const useCase = new LoginUseCase({
      userRepository,
      passwordHasher: { compare: jest.fn().mockResolvedValue(true) },
      tokenService: { signAccessToken: jest.fn() },
      refreshTokenStore: { issue: jest.fn() },
    });

    await expect(useCase.execute({ email: 'jane@example.com', password: 'x' })).rejects.toThrow(
      'awaiting manager approval'
    );
  });

  it('rejects a rejected account', async () => {
    const userRepository = {
      findByEmail: jest.fn().mockResolvedValue(buildUser({ status: 'rejected' })),
    };
    const useCase = new LoginUseCase({
      userRepository,
      passwordHasher: { compare: jest.fn().mockResolvedValue(true) },
      tokenService: { signAccessToken: jest.fn() },
      refreshTokenStore: { issue: jest.fn() },
    });

    await expect(useCase.execute({ email: 'jane@example.com', password: 'x' })).rejects.toThrow(
      'request was rejected'
    );
  });

  it('rejects a deactivated account', async () => {
    const userRepository = {
      findByEmail: jest.fn().mockResolvedValue(buildUser({ status: 'deactivated' })),
    };
    const useCase = new LoginUseCase({
      userRepository,
      passwordHasher: { compare: jest.fn().mockResolvedValue(true) },
      tokenService: { signAccessToken: jest.fn() },
      refreshTokenStore: { issue: jest.fn() },
    });

    await expect(useCase.execute({ email: 'jane@example.com', password: 'x' })).rejects.toThrow(
      'cannot log in'
    );
  });

  it('issues an access token and a refresh token for a valid, approved login', async () => {
    const userRepository = { findByEmail: jest.fn().mockResolvedValue(buildUser()) };
    const tokenService = { signAccessToken: jest.fn().mockReturnValue('signed-jwt') };
    const refreshTokenStore = { issue: jest.fn().mockResolvedValue('opaque-refresh-token') };
    const useCase = new LoginUseCase({
      userRepository,
      passwordHasher: { compare: jest.fn().mockResolvedValue(true) },
      tokenService,
      refreshTokenStore,
    });

    const result = await useCase.execute({ email: 'jane@example.com', password: 'correct' });

    expect(result.accessToken).toBe('signed-jwt');
    expect(result.refreshToken).toBe('opaque-refresh-token');
    expect(tokenService.signAccessToken).toHaveBeenCalledWith({ userId: 1, role: 'Sales' });
    expect(refreshTokenStore.issue).toHaveBeenCalledWith(1);
  });

  it('rejects a SuperAdmin with the same generic message when excludeRole is set (regular login page)', async () => {
    const userRepository = {
      findByEmail: jest.fn().mockResolvedValue(buildUser({ roleName: 'SuperAdmin' })),
    };
    const useCase = new LoginUseCase({
      userRepository,
      passwordHasher: { compare: jest.fn().mockResolvedValue(true) },
      tokenService: { signAccessToken: jest.fn() },
      refreshTokenStore: { issue: jest.fn() },
    });

    await expect(
      useCase.execute({ email: 'jane@example.com', password: 'correct', excludeRole: 'SuperAdmin' })
    ).rejects.toThrow('Invalid credentials');
  });

  it('rejects a non-SuperAdmin with the same generic message when requireRole is set (admin login page)', async () => {
    const userRepository = { findByEmail: jest.fn().mockResolvedValue(buildUser({ roleName: 'Sales' })) };
    const useCase = new LoginUseCase({
      userRepository,
      passwordHasher: { compare: jest.fn().mockResolvedValue(true) },
      tokenService: { signAccessToken: jest.fn() },
      refreshTokenStore: { issue: jest.fn() },
    });

    await expect(
      useCase.execute({ email: 'jane@example.com', password: 'correct', requireRole: 'SuperAdmin' })
    ).rejects.toThrow('Invalid credentials');
  });

  it('allows a SuperAdmin through when requireRole is set (admin login page)', async () => {
    const userRepository = {
      findByEmail: jest.fn().mockResolvedValue(buildUser({ roleName: 'SuperAdmin' })),
    };
    const tokenService = { signAccessToken: jest.fn().mockReturnValue('signed-jwt') };
    const refreshTokenStore = { issue: jest.fn().mockResolvedValue('opaque-refresh-token') };
    const useCase = new LoginUseCase({
      userRepository,
      passwordHasher: { compare: jest.fn().mockResolvedValue(true) },
      tokenService,
      refreshTokenStore,
    });

    const result = await useCase.execute({
      email: 'jane@example.com',
      password: 'correct',
      requireRole: 'SuperAdmin',
    });

    expect(result.accessToken).toBe('signed-jwt');
  });
});
