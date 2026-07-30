import bcrypt from 'bcrypt';

const SALT_ROUNDS = 10;

class PasswordHasher {
  async hash(plainPassword) {
    return bcrypt.hash(plainPassword, SALT_ROUNDS);
  }

  async compare(plainPassword, hash) {
    return bcrypt.compare(plainPassword, hash);
  }
}

export { PasswordHasher };
