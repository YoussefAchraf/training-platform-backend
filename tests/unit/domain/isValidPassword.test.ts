import { isValidPassword, MIN_LENGTH } from '../../../src/domain/validation/isValidPassword';

describe('isValidPassword', () => {
  it('accepts a password with at least the minimum length, a letter, and a number', () => {
    expect(isValidPassword('abcdefgh12')).toBe(true);
    expect(isValidPassword('Sup3rSecret!Pass')).toBe(true);
  });

  it('rejects a password shorter than the minimum length', () => {
    expect(isValidPassword('a1'.repeat(Math.ceil((MIN_LENGTH - 1) / 2)).slice(0, MIN_LENGTH - 1))).toBe(false);
  });

  it('rejects a password with no letters', () => {
    expect(isValidPassword('1234567890')).toBe(false);
  });

  it('rejects a password with no numbers', () => {
    expect(isValidPassword('abcdefghij')).toBe(false);
  });

  it('rejects non-string values without throwing', () => {
    expect(isValidPassword(undefined)).toBe(false);
    expect(isValidPassword(null)).toBe(false);
    expect(isValidPassword(12345678901)).toBe(false);
  });
});
