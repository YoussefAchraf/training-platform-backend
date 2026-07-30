import { User, ROLES, USER_STATUS } from '../../domain/entities/User';

class SignupUseCase {
  userRepository: any;
  instructorRepository: any;
  passwordHasher: any;
  emailService: any;

  constructor({ userRepository, instructorRepository, passwordHasher, emailService }) {
    this.userRepository = userRepository;
    this.instructorRepository = instructorRepository;
    this.passwordHasher = passwordHasher;
    this.emailService = emailService;
  }

  async execute({ firstname, lastname, email, password, role }) {
    if (!Object.values(ROLES).includes(role)) {
      throw new Error(`role must be one of: ${Object.values(ROLES).join(', ')}`);
    }

    const existing = await this.userRepository.findByEmail(email);
    if (existing) {
      throw new Error('An account with this email already exists');
    }

    const roleRow = await this.userRepository.findRoleByName(role);
    if (!roleRow) {
      throw new Error(`Role ${role} is not configured in the database`);
    }

    const passwordHash = await this.passwordHasher.hash(password);

    const user = await this.userRepository.create(
      new User({
        firstname,
        lastname,
        email,
        passwordHash,
        roleId: roleRow.id,
        status: USER_STATUS.PENDING, 
      })
    );

    
    
    if (role === ROLES.INSTRUCTOR) {
      await this.instructorRepository.create({ userId: user.id, bio: '' });
    }

    
    
    
    const managers = await this.userRepository.listApprovedManagers();
    await this.emailService.sendNewSignupNotification(
      managers.map((m) => m.email),
      { firstname: user.firstname, lastname: user.lastname, email: user.email, roleName: role }
    );

    return user.toSafeJSON();
  }
}

export { SignupUseCase };
