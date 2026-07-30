class LogoutUseCase {
  refreshTokenStore: any;

  constructor({ refreshTokenStore }) {
    this.refreshTokenStore = refreshTokenStore;
  }

  async execute({ refreshToken }) {
    
    
    
    if (refreshToken) {
      await this.refreshTokenStore.revoke(refreshToken);
    }
    return { message: 'Logged out' };
  }
}

export { LogoutUseCase };
