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

  
  
  
  
  
  
  
  
  
  
  
  async execute({ email, password, requireRole, excludeRole }: { email: any; password: any; requireRole?: string; excludeRole?: string }) {
    const user = await this.userRepository.findByEmail(email);
    if (!user) {
      throw new Error('Invalid credentials');
    }

    const passwordMatches = await this.passwordHasher.compare(password, user.passwordHash);
    if (!passwordMatches) {
      throw new Error('Invalid credentials');
    }

    if (requireRole && user.roleName !== requireRole) {
      throw new Error('Invalid credentials');
    }
    if (excludeRole && user.roleName === excludeRole) {
      throw new Error('Invalid credentials');
    }

    if (user.status === 'pending') {
      throw new Error('Your account is awaiting manager approval');
    }
    if (user.status === 'rejected') {
      throw new Error('Your account request was rejected');
    }
    if (!user.isApproved()) {
      
      
      
      
      throw new Error('Your account cannot log in. Contact a Manager for details.');
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
