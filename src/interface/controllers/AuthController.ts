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
      const result = await this.loginUseCase.execute({ email, password });
      res.status(200).json(result);
    } catch (err) {
      res.status(401).json({ error: err.message });
    }
  };

  refresh = async (req, res) => {
    try {
      const { refreshToken } = req.body;
      const result = await this.refreshTokenUseCase.execute({ refreshToken });
      res.status(200).json(result);
    } catch (err) {
      res.status(401).json({ error: err.message });
    }
  };

  logout = async (req, res) => {
    try {
      const { refreshToken } = req.body;
      const result = await this.logoutUseCase.execute({ refreshToken });
      res.status(200).json(result);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
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
      const { firstname, lastname } = req.body;
      const user = await this.updateOwnProfileUseCase.execute({ requester: req.user, firstname, lastname });
      res.status(200).json(user);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  };
}

export { AuthController };
