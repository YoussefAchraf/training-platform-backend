import authMiddlewareFactory from '../../../src/interface/middlewares/authMiddleware';

function buildRes() {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

function buildApprovedUser() {
  return { id: 1, isApproved: () => true };
}

describe('authMiddleware', () => {
  it('rejects with 401 when there is no accessToken cookie', async () => {
    const tokenService = { verifyAccessToken: jest.fn() };
    const userRepository = { findById: jest.fn() };
    const middleware = authMiddlewareFactory({ tokenService, userRepository });
    const req: any = { cookies: {}, headers: {}, method: 'GET' };
    const res = buildRes();
    const next = jest.fn();

    await middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects with 401 when the access token is invalid or expired', async () => {
    const tokenService = {
      verifyAccessToken: jest.fn().mockImplementation(() => {
        throw new Error('bad token');
      }),
    };
    const userRepository = { findById: jest.fn() };
    const middleware = authMiddlewareFactory({ tokenService, userRepository });
    const req: any = { cookies: { accessToken: 'bad' }, headers: {}, method: 'GET' };
    const res = buildRes();
    const next = jest.fn();

    await middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects with 401 when the user no longer exists or is not approved', async () => {
    const tokenService = { verifyAccessToken: jest.fn().mockReturnValue({ userId: 1 }) };
    const userRepository = { findById: jest.fn().mockResolvedValue(null) };
    const middleware = authMiddlewareFactory({ tokenService, userRepository });
    const req: any = { cookies: { accessToken: 'good' }, headers: {}, method: 'GET' };
    const res = buildRes();
    const next = jest.fn();

    await middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('calls next and sets req.user for a valid token and a GET request (CSRF exempt)', async () => {
    const tokenService = { verifyAccessToken: jest.fn().mockReturnValue({ userId: 1 }) };
    const userRepository = { findById: jest.fn().mockResolvedValue(buildApprovedUser()) };
    const middleware = authMiddlewareFactory({ tokenService, userRepository });
    const req: any = { cookies: { accessToken: 'good' }, headers: {}, method: 'GET' };
    const res = buildRes();
    const next = jest.fn();

    await middleware(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.user).toBeDefined();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('rejects a POST request with 403 when the CSRF header does not match the CSRF cookie', async () => {
    const tokenService = { verifyAccessToken: jest.fn().mockReturnValue({ userId: 1 }) };
    const userRepository = { findById: jest.fn().mockResolvedValue(buildApprovedUser()) };
    const middleware = authMiddlewareFactory({ tokenService, userRepository });
    const req: any = {
      cookies: { accessToken: 'good', csrfToken: 'abc' },
      headers: { 'x-csrf-token': 'wrong' },
      method: 'POST',
    };
    const res = buildRes();
    const next = jest.fn();

    await middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('calls next for a POST request when the CSRF header matches the CSRF cookie', async () => {
    const tokenService = { verifyAccessToken: jest.fn().mockReturnValue({ userId: 1 }) };
    const userRepository = { findById: jest.fn().mockResolvedValue(buildApprovedUser()) };
    const middleware = authMiddlewareFactory({ tokenService, userRepository });
    const req: any = {
      cookies: { accessToken: 'good', csrfToken: 'abc' },
      headers: { 'x-csrf-token': 'abc' },
      method: 'POST',
    };
    const res = buildRes();
    const next = jest.fn();

    await middleware(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  
  
  
  it('authenticates a GET request via a Bearer header when there is no cookie', async () => {
    const tokenService = { verifyAccessToken: jest.fn().mockReturnValue({ userId: 1 }) };
    const userRepository = { findById: jest.fn().mockResolvedValue(buildApprovedUser()) };
    const middleware = authMiddlewareFactory({ tokenService, userRepository });
    const req: any = { cookies: {}, headers: { authorization: 'Bearer good' }, method: 'GET' };
    const res = buildRes();
    const next = jest.fn();

    await middleware(req, res, next);

    expect(tokenService.verifyAccessToken).toHaveBeenCalledWith('good');
    expect(next).toHaveBeenCalled();
    expect(req.user).toBeDefined();
    expect(res.status).not.toHaveBeenCalled();
  });

  
  
  
  
  it('authenticates a POST request via a Bearer header without requiring a CSRF header', async () => {
    const tokenService = { verifyAccessToken: jest.fn().mockReturnValue({ userId: 1 }) };
    const userRepository = { findById: jest.fn().mockResolvedValue(buildApprovedUser()) };
    const middleware = authMiddlewareFactory({ tokenService, userRepository });
    const req: any = { cookies: {}, headers: { authorization: 'Bearer good' }, method: 'POST' };
    const res = buildRes();
    const next = jest.fn();

    await middleware(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('prefers the cookie over a Bearer header when both are present, and still enforces CSRF', async () => {
    const tokenService = { verifyAccessToken: jest.fn().mockReturnValue({ userId: 1 }) };
    const userRepository = { findById: jest.fn().mockResolvedValue(buildApprovedUser()) };
    const middleware = authMiddlewareFactory({ tokenService, userRepository });
    const req: any = {
      cookies: { accessToken: 'cookie-token', csrfToken: 'abc' },
      headers: { authorization: 'Bearer header-token', 'x-csrf-token': 'wrong' },
      method: 'POST',
    };
    const res = buildRes();
    const next = jest.fn();

    await middleware(req, res, next);

    expect(tokenService.verifyAccessToken).toHaveBeenCalledWith('cookie-token');
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });
});
