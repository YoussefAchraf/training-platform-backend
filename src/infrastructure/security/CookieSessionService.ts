import crypto from 'crypto';










const ACCESS_TOKEN_COOKIE = 'accessToken';
const REFRESH_TOKEN_COOKIE = 'refreshToken';
const CSRF_TOKEN_COOKIE = 'csrfToken';

function parseDurationToMs(duration: string, fallbackMs: number): number {
  const match = /^(\d+)\s*(s|m|h|d)$/.exec(String(duration).trim());
  if (!match) return fallbackMs;
  const value = Number(match[1]);
  const msPerUnit = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };
  return value * msPerUnit[match[2] as 's' | 'm' | 'h' | 'd'];
}

function accessTokenMaxAgeMs(): number {
  return parseDurationToMs(process.env.JWT_EXPIRES_IN || '8h', 8 * 3_600_000);
}

function refreshTokenMaxAgeMs(): number {
  const days = Number(process.env.REFRESH_TOKEN_TTL_DAYS) || 30;
  return days * 86_400_000;
}















function baseCookieOptions() {
  const domain = process.env.COOKIE_DOMAIN;
  return {
    httpOnly: true,
    secure: true,
    sameSite: 'none' as const,
    path: '/',
    ...(domain ? { domain } : {}),
  };
}




function setSessionCookies(res, { accessToken, refreshToken }: { accessToken: string; refreshToken: string }) {
  res.cookie(ACCESS_TOKEN_COOKIE, accessToken, { ...baseCookieOptions(), maxAge: accessTokenMaxAgeMs() });
  
  
  
  
  res.cookie(REFRESH_TOKEN_COOKIE, refreshToken, {
    ...baseCookieOptions(),
    path: '/auth',
    maxAge: refreshTokenMaxAgeMs(),
  });
  
  
  
  
  
  res.cookie(CSRF_TOKEN_COOKIE, crypto.randomBytes(32).toString('base64url'), {
    httpOnly: false,
    secure: true,
    sameSite: 'none',
    path: '/',
    maxAge: refreshTokenMaxAgeMs(),
    ...(process.env.COOKIE_DOMAIN ? { domain: process.env.COOKIE_DOMAIN } : {}),
  });
}

function clearSessionCookies(res) {
  res.clearCookie(ACCESS_TOKEN_COOKIE, { ...baseCookieOptions() });
  res.clearCookie(REFRESH_TOKEN_COOKIE, { ...baseCookieOptions(), path: '/auth' });
  
  
  
  res.clearCookie(CSRF_TOKEN_COOKIE, {
    httpOnly: false,
    secure: true,
    sameSite: 'none',
    path: '/',
    ...(process.env.COOKIE_DOMAIN ? { domain: process.env.COOKIE_DOMAIN } : {}),
  });
}

const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);








function csrfCheckPasses(req): boolean {
  if (!UNSAFE_METHODS.has(req.method)) return true;
  const cookieValue = req.cookies?.[CSRF_TOKEN_COOKIE];
  const headerValue = req.headers['x-csrf-token'];
  return Boolean(cookieValue) && cookieValue === headerValue;
}

export {
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
  CSRF_TOKEN_COOKIE,
  setSessionCookies,
  clearSessionCookies,
  csrfCheckPasses,
};
