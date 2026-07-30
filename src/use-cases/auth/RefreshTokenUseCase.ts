class RefreshTokenUseCase {
  userRepository: any;
  tokenService: any;
  refreshTokenStore: any;

  constructor({ userRepository, tokenService, refreshTokenStore }) {
    this.userRepository = userRepository;
    this.tokenService = tokenService;
    this.refreshTokenStore = refreshTokenStore;
  }

  async execute({ refreshToken }) {
    if (!refreshToken) {
      throw new Error('refreshToken is required');
    }

    const userId = await this.refreshTokenStore.verify(refreshToken);
    if (!userId) {
      throw new Error('Invalid or expired refresh token');
    }

    
    
    
    await this.refreshTokenStore.revoke(refreshToken);

    const user = await this.userRepository.findById(userId);
    if (!user || !user.isApproved()) {
      throw new Error('Account not found or not approved');
    }

    const accessToken = this.tokenService.signAccessToken({
      userId: user.id,
      role: user.roleName,
    });
    const newRefreshToken = await this.refreshTokenStore.issue(user.id);

    return { accessToken, refreshToken: newRefreshToken };
  }
}

export { RefreshTokenUseCase };
