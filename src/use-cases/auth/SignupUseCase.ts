import { User, ROLES, SELF_SIGNUP_ROLES, USER_STATUS } from '../../domain/entities/User';
import { isValidEmail } from '../../domain/validation/isValidEmail';

class SignupUseCase {
  userRepository: any;
  instructorRepository: any;
  passwordHasher: any;
  emailService: any;
  auditLogRepository: any;

  constructor({ userRepository, instructorRepository, passwordHasher, emailService, auditLogRepository }) {
    this.userRepository = userRepository;
    this.instructorRepository = instructorRepository;
    this.passwordHasher = passwordHasher;
    this.emailService = emailService;
    this.auditLogRepository = auditLogRepository;
  }

  async execute({ firstname, lastname, email, password, role }) {
    if (!Object.values(SELF_SIGNUP_ROLES).includes(role)) {
      throw new Error(`role must be one of: ${Object.values(SELF_SIGNUP_ROLES).join(', ')}`);
    }

    if (!isValidEmail(email)) {
      throw new Error('A valid email address is required');
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

    await this.auditLogRepository.create({
      actorId: user.id,
      action: 'create',
      entityType: 'User',
      entityId: user.id,
      after: user.toSafeJSON(),
    });

    if (role === ROLES.INSTRUCTOR) {
      await this.instructorRepository.create({ userId: user.id, bio: '' });
    }

    
    
    
    try {
      const managers = await this.userRepository.listApprovedManagers();
      await this.emailService.sendNewSignupNotification(
        managers.map((m) => m.email),
        { firstname: user.firstname, lastname: user.lastname, email: user.email, roleName: role }
      );
    } catch (err) {
      console.error('Failed to send new-signup notification:', err.message);
    }

    return user.toSafeJSON();
  }
}

export { SignupUseCase };
