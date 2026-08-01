import 'dotenv/config';
import { Pool } from 'pg';
import { PgUserRepository } from '../src/infrastructure/repositories/PgUserRepository';
import { PasswordHasher } from '../src/infrastructure/security/PasswordHasher';
import { User, ROLES, USER_STATUS } from '../src/domain/entities/User';





async function seedSuperAdmin() {
  const { SUPERADMIN_EMAIL, SUPERADMIN_PASSWORD, SUPERADMIN_FIRSTNAME, SUPERADMIN_LASTNAME } = process.env;

  const missing = ['SUPERADMIN_EMAIL', 'SUPERADMIN_PASSWORD', 'SUPERADMIN_FIRSTNAME', 'SUPERADMIN_LASTNAME'].filter(
    (key) => !process.env[key]
  );
  if (missing.length > 0) {
    console.error(`Missing required environment variables: ${missing.join(', ')}`);
    process.exitCode = 1;
    return;
  }

  if (SUPERADMIN_PASSWORD.length < 12) {
    console.error('SUPERADMIN_PASSWORD must be at least 12 characters');
    process.exitCode = 1;
    return;
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const userRepository = new PgUserRepository(pool);
  const passwordHasher = new PasswordHasher();

  try {
    const existing = await userRepository.findByEmail(SUPERADMIN_EMAIL);
    if (existing) {
      console.log(`A user with email ${SUPERADMIN_EMAIL} already exists (id=${existing.id}) - nothing to do.`);
      return;
    }

    const roleRow = await userRepository.findRoleByName(ROLES.SUPER_ADMIN);
    if (!roleRow) {
      throw new Error("Role 'SuperAdmin' is not configured in the database - run db:migrate first");
    }

    const passwordHash = await passwordHasher.hash(SUPERADMIN_PASSWORD);

    const user = await userRepository.create(
      new User({
        firstname: SUPERADMIN_FIRSTNAME,
        lastname: SUPERADMIN_LASTNAME,
        email: SUPERADMIN_EMAIL,
        passwordHash,
        roleId: roleRow.id,
        status: USER_STATUS.APPROVED,
      })
    );

    console.log(`SuperAdmin user created: id=${user.id}, email=${user.email}`);
  } catch (err) {
    console.error('Failed to seed SuperAdmin:', err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

seedSuperAdmin();
