class LoginUseCase {
  userRepository: any;
  passwordHasher: any;
  tokenService: any;
  refreshTokenStore: any;

  constructor({ userRepository, passwordHasher, tokenService, refreshTokenStore }) {
    this.userRepository = userRepository;
    this.passwordHasher = passwordHasher;
    this.tokenService = tokenService;
    this.refreshTokenStore = refreshTokenStore;
  }

  async execute({ email, password }) {
    const user = await this.userRepository.findByEmail(email);
    if (!user) {
      throw new Error('Invalid credentials');
    }

    const passwordMatches = await this.passwordHasher.compare(password, user.passwordHash);
    if (!passwordMatches) {
      throw new Error('Invalid credentials');
    }

    if (user.status === 'pending') {
      throw new Error('Your account is awaiting manager approval');
    }
    if (user.status === 'rejected') {
      throw new Error('Your account request was rejected');
    }

    const accessToken = this.tokenService.signAccessToken({
      userId: user.id,
      role: user.roleName,
    });
    const refreshToken = await this.refreshTokenStore.issue(user.id);

    return { accessToken, refreshToken, user: user.toSafeJSON() };
  }
}

export { LoginUseCase };
