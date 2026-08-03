import { isValidEmail } from '../../../src/domain/validation/isValidEmail';

describe('isValidEmail', () => {
  it('accepts well-formed email addresses', () => {
    expect(isValidEmail('a@b.com')).toBe(true);
    expect(isValidEmail('first.last+tag@sub.example.co')).toBe(true);
  });

  it('rejects malformed email addresses', () => {
    expect(isValidEmail('not-an-email')).toBe(false);
    expect(isValidEmail('missing-domain@')).toBe(false);
    expect(isValidEmail('@missing-local.com')).toBe(false);
    expect(isValidEmail('spaces in@email.com')).toBe(false);
  });

  it('rejects non-string values without throwing', () => {
    expect(isValidEmail(undefined)).toBe(false);
    expect(isValidEmail(null)).toBe(false);
    expect(isValidEmail(123)).toBe(false);
  });
});
