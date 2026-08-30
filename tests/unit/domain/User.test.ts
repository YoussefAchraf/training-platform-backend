import { User, ROLES } from '../../../src/domain/entities/User';

function buildUser(roleName: string) {
  return new User({
    id: 1,
    firstname: 'Test',
    lastname: 'User',
    email: 'test@example.com',
    passwordHash: 'hash',
    roleId: 1,
    roleName,
  });
}

describe('User entity - canManageCatalog', () => {
  it.each([ROLES.SALES, ROLES.MANAGER, ROLES.SUPER_ADMIN])(
    'returns true for %s',
    (roleName) => {
      expect(buildUser(roleName).canManageCatalog()).toBe(true);
    },
  );

  it('returns false for Instructor', () => {
    expect(buildUser(ROLES.INSTRUCTOR).canManageCatalog()).toBe(false);
  });
});
