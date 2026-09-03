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

  it('returns false for Developer', () => {
    expect(buildUser(ROLES.DEVELOPER).canManageCatalog()).toBe(false);
  });
});

describe('User entity - isDeveloper', () => {
  it('returns true only for a Developer roleName', () => {
    expect(buildUser(ROLES.DEVELOPER).isDeveloper()).toBe(true);
  });

  it.each([ROLES.SALES, ROLES.MANAGER, ROLES.INSTRUCTOR, ROLES.SUPER_ADMIN])(
    'returns false for %s',
    (roleName) => {
      expect(buildUser(roleName).isDeveloper()).toBe(false);
    },
  );
});
