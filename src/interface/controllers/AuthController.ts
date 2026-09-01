class AuthController {
  signupUseCase: any;
  loginUseCase: any;
  listPendingUsersUseCase: any;
  approveUserUseCase: any;
  refreshTokenUseCase: any;
  logoutUseCase: any;
  listAllUsersUseCase: any;
  updateUserByAdminUseCase: any;
  deactivateUserUseCase: any;
  updateOwnProfileUseCase: any;
  tokenService: any;
  listRolesUseCase: any;
  setSessionCookies: any;
  clearSessionCookies: any;
  csrfCheckPasses: any;
  requestPasswordResetUseCase: any;
  resetPasswordUseCase: any;
  changeOwnPasswordUseCase: any;

  constructor({
    signupUseCase,
    loginUseCase,
    listPendingUsersUseCase,
    approveUserUseCase,
    refreshTokenUseCase,
    logoutUseCase,
    listAllUsersUseCase,
    updateUserByAdminUseCase,
    deactivateUserUseCase,
    updateOwnProfileUseCase,
    tokenService,
    listRolesUseCase,
    setSessionCookies,
    clearSessionCookies,
    csrfCheckPasses,
    requestPasswordResetUseCase,
    resetPasswordUseCase,
    changeOwnPasswordUseCase,
  }) {
    this.signupUseCase = signupUseCase;
    this.loginUseCase = loginUseCase;
    this.listPendingUsersUseCase = listPendingUsersUseCase;
    this.approveUserUseCase = approveUserUseCase;
    this.refreshTokenUseCase = refreshTokenUseCase;
    this.logoutUseCase = logoutUseCase;
    this.listAllUsersUseCase = listAllUsersUseCase;
    this.updateUserByAdminUseCase = updateUserByAdminUseCase;
    this.deactivateUserUseCase = deactivateUserUseCase;
    this.updateOwnProfileUseCase = updateOwnProfileUseCase;
    this.tokenService = tokenService;
    this.listRolesUseCase = listRolesUseCase;
    this.setSessionCookies = setSessionCookies;
    this.clearSessionCookies = clearSessionCookies;
    this.csrfCheckPasses = csrfCheckPasses;
    this.requestPasswordResetUseCase = requestPasswordResetUseCase;
    this.resetPasswordUseCase = resetPasswordUseCase;
    this.changeOwnPasswordUseCase = changeOwnPasswordUseCase;
  }

  signup = async (req, res) => {
    try {
      const { firstname, lastname, email, password, role } = req.body;
      const user = await this.signupUseCase.execute({ firstname, lastname, email, password, role });
      res.status(201).json({ message: 'Account created. Awaiting manager approval.', user });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  };

  
  
  
  
  login = async (req, res) => {
    try {
      const { email, password } = req.body;
      const { accessToken, refreshToken, user } = await this.loginUseCase.execute({
        email,
        password,
        excludeRole: 'SuperAdmin',
      });
      this.setSessionCookies(res, { accessToken, refreshToken });
      res.status(200).json({ user });
    } catch (err) {
      res.status(401).json({ error: err.message });
    }
  };

  adminLogin = async (req, res) => {
    try {
      const { email, password } = req.body;
      const { accessToken, refreshToken, user } = await this.loginUseCase.execute({
        email,
        password,
        requireRole: 'SuperAdmin',
      });
      this.setSessionCookies(res, { accessToken, refreshToken });
      res.status(200).json({ user });
    } catch (err) {
      res.status(401).json({ error: err.message });
    }
  };

  
  
  
  refresh = async (req, res) => {
    try {
      if (!this.csrfCheckPasses(req)) {
        res.status(403).json({ error: 'Invalid CSRF token' });
        return;
      }
      const refreshToken = req.cookies?.refreshToken;
      const { accessToken, refreshToken: newRefreshToken } = await this.refreshTokenUseCase.execute({
        refreshToken,
      });
      this.setSessionCookies(res, { accessToken, refreshToken: newRefreshToken });
      res.status(200).json({ message: 'Session refreshed' });
    } catch (err) {
      this.clearSessionCookies(res);
      res.status(401).json({ error: err.message });
    }
  };

  logout = async (req, res) => {
    try {
      const refreshToken = req.cookies?.refreshToken;
      const result = await this.logoutUseCase.execute({ refreshToken });
      this.clearSessionCookies(res);
      res.status(200).json(result);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  };

  
  
  
  me = async (req, res) => {
    res.status(200).json({ user: req.user ? req.user.toSafeJSON() : null });
  };

  
  
  
  
  listRoles = async (_req, res) => {
    const roles = await this.listRolesUseCase.execute();
    res.status(200).json(roles);
  };

  
  
  
  
  
  
  
  
  
  
  serviceToken = async (req, res) => {
    const accessToken = this.tokenService.signAccessToken({
      userId: req.user.id,
      role: req.user.roleName,
    });
    res.status(200).json({ accessToken });
  };

  listPending = async (req, res) => {
    try {
      const users = await this.listPendingUsersUseCase.execute({ managerUser: req.user });
      res.status(200).json(users);
    } catch (err) {
      res.status(403).json({ error: err.message });
    }
  };

  approve = async (req, res) => {
    try {
      const user = await this.approveUserUseCase.execute({
        managerUser: req.user,
        targetUserId: Number(req.params.id),
        decision: 'approve',
      });
      res.status(200).json(user);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  };

  reject = async (req, res) => {
    try {
      const user = await this.approveUserUseCase.execute({
        managerUser: req.user,
        targetUserId: Number(req.params.id),
        decision: 'reject',
      });
      res.status(200).json(user);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  };

  listAllUsers = async (req, res) => {
    try {
      const users = await this.listAllUsersUseCase.execute({ requester: req.user });
      res.status(200).json(users);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  };

  updateUserByAdmin = async (req, res) => {
    try {
      const { firstname, lastname, email, role, status } = req.body;
      const user = await this.updateUserByAdminUseCase.execute({
        requester: req.user,
        targetUserId: Number(req.params.id),
        firstname,
        lastname,
        email,
        role,
        status,
      });
      res.status(200).json(user);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  };

  deactivateUser = async (req, res) => {
    try {
      const user = await this.deactivateUserUseCase.execute({
        requester: req.user,
        targetUserId: Number(req.params.id),
      });
      res.status(200).json(user);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  };

  updateMe = async (req, res) => {
    try {
      const { firstname, lastname, hasSeenTour } = req.body;
      const user = await this.updateOwnProfileUseCase.execute({
        requester: req.user,
        firstname,
        lastname,
        hasSeenTour,
      });
      res.status(200).json(user);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  };

  sendPasswordReset = async (req, res) => {
    try {
      const result = await this.requestPasswordResetUseCase.execute({
        requester: req.user,
        targetUserId: Number(req.params.id),
      });
      res.status(200).json(result);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  };

  resetPassword = async (req, res) => {
    try {
      const { token, newPassword } = req.body;
      const result = await this.resetPasswordUseCase.execute({ token, newPassword });
      res.status(200).json(result);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  };

  changePassword = async (req, res) => {
    try {
      const { currentPassword, newPassword } = req.body;
      const { accessToken, refreshToken } = await this.changeOwnPasswordUseCase.execute({
        requester: req.user,
        currentPassword,
        newPassword,
      });
      this.setSessionCookies(res, { accessToken, refreshToken });
      res.status(200).json({ message: 'Password changed.' });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  };
}

export { AuthController };
