import {
  setSessionCookies,
  clearSessionCookies,
  csrfCheckPasses,
} from '../../../src/infrastructure/security/CookieSessionService';

function buildRes() {
  const res: any = {};
  res.cookie = jest.fn().mockReturnValue(res);
  res.clearCookie = jest.fn().mockReturnValue(res);
  return res;
}

describe('CookieSessionService', () => {
  describe('setSessionCookies', () => {
    it('sets accessToken and refreshToken as httpOnly, and csrfToken as readable by JS', () => {
      const res = buildRes();

      setSessionCookies(res, { accessToken: 'access-123', refreshToken: 'refresh-456' });

      expect(res.cookie).toHaveBeenCalledWith(
        'accessToken',
        'access-123',
        expect.objectContaining({ httpOnly: true, secure: true, sameSite: 'none', path: '/' })
      );
      expect(res.cookie).toHaveBeenCalledWith(
        'refreshToken',
        'refresh-456',
        expect.objectContaining({ httpOnly: true, secure: true, sameSite: 'none', path: '/auth' })
      );
      const csrfCall = res.cookie.mock.calls.find(([name]) => name === 'csrfToken');
      expect(csrfCall).toBeDefined();
      expect(csrfCall[2]).toEqual(expect.objectContaining({ httpOnly: false, secure: true, sameSite: 'none' }));
      expect(typeof csrfCall[1]).toBe('string');
      expect(csrfCall[1].length).toBeGreaterThan(0);
    });
  });

  describe('clearSessionCookies', () => {
    it('clears all three cookies', () => {
      const res = buildRes();

      clearSessionCookies(res);

      expect(res.clearCookie).toHaveBeenCalledWith('accessToken', expect.any(Object));
      expect(res.clearCookie).toHaveBeenCalledWith('refreshToken', expect.objectContaining({ path: '/auth' }));
      expect(res.clearCookie).toHaveBeenCalledWith('csrfToken', expect.any(Object));
    });
  });

  describe('csrfCheckPasses', () => {
    it('allows safe methods (GET) through regardless of tokens', () => {
      const req: any = { method: 'GET', cookies: {}, headers: {} };
      expect(csrfCheckPasses(req)).toBe(true);
    });

    it('rejects an unsafe method when the CSRF cookie is missing', () => {
      const req: any = { method: 'POST', cookies: {}, headers: { 'x-csrf-token': 'abc' } };
      expect(csrfCheckPasses(req)).toBe(false);
    });

    it('rejects an unsafe method when the header does not match the cookie', () => {
      const req: any = {
        method: 'POST',
        cookies: { csrfToken: 'abc' },
        headers: { 'x-csrf-token': 'different' },
      };
      expect(csrfCheckPasses(req)).toBe(false);
    });

    it('allows an unsafe method when the header matches the cookie', () => {
      const req: any = {
        method: 'POST',
        cookies: { csrfToken: 'abc' },
        headers: { 'x-csrf-token': 'abc' },
      };
      expect(csrfCheckPasses(req)).toBe(true);
    });
  });
});
