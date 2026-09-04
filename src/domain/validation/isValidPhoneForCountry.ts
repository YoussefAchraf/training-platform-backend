import { isValidPhoneNumber, isSupportedCountry } from 'libphonenumber-js';
import type { CountryCode } from 'libphonenumber-js';





function isValidPhoneForCountry(phone: string, country?: string | null): boolean {
  if (typeof phone !== 'string' || !phone.trim()) return false;
  if (!country) return true;
  if (!isSupportedCountry(country)) return false;
  return isValidPhoneNumber(phone, country as CountryCode);
}

export { isValidPhoneForCountry };
