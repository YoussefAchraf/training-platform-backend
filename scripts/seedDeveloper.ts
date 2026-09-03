import 'dotenv/config';
import { prismaClient } from '../src/infrastructure/database/prismaClient';
import { PgUserRepository } from '../src/infrastructure/repositories/PgUserRepository';
import { PasswordHasher } from '../src/infrastructure/security/PasswordHasher';
import { User, ROLES, USER_STATUS } from '../src/domain/entities/User';

async function seedDeveloper() {
  const { DEVELOPER_EMAIL, DEVELOPER_PASSWORD, DEVELOPER_FIRSTNAME, DEVELOPER_LASTNAME } = process.env;

  const missing = ['DEVELOPER_EMAIL', 'DEVELOPER_PASSWORD', 'DEVELOPER_FIRSTNAME', 'DEVELOPER_LASTNAME'].filter(
    (key) => !process.env[key]
  );
  if (missing.length > 0) {
    console.error(`Missing required environment variables: ${missing.join(', ')}`);
    process.exitCode = 1;
    return;
  }

  if (DEVELOPER_PASSWORD.length < 12) {
    console.error('DEVELOPER_PASSWORD must be at least 12 characters');
    process.exitCode = 1;
    return;
  }

  const userRepository = new PgUserRepository(prismaClient);
  const passwordHasher = new PasswordHasher();

  try {
    const existing = await userRepository.findByEmail(DEVELOPER_EMAIL);
    if (existing) {
      console.log(`A user with email ${DEVELOPER_EMAIL} already exists (id=${existing.id}) - nothing to do.`);
      return;
    }

    const roleRow = await userRepository.findRoleByName(ROLES.DEVELOPER);
    if (!roleRow) {
      throw new Error("Role 'Developer' is not configured in the database - run db:migrate first");
    }

    const passwordHash = await passwordHasher.hash(DEVELOPER_PASSWORD);

    const user = await userRepository.create(
      new User({
        firstname: DEVELOPER_FIRSTNAME,
        lastname: DEVELOPER_LASTNAME,
        email: DEVELOPER_EMAIL,
        passwordHash,
        roleId: roleRow.id,
        status: USER_STATUS.APPROVED,
      })
    );

    console.log(`Developer user created: id=${user.id}, email=${user.email}`);
  } catch (err) {
    console.error('Failed to seed Developer:', err.message);
    process.exitCode = 1;
  } finally {
    await prismaClient.$disconnect();
  }
}

seedDeveloper();
