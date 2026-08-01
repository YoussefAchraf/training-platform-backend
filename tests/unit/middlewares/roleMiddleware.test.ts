import requireRole from '../../../src/interface/middlewares/roleMiddleware';

function buildRes() {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe('requireRole', () => {
  it('rejects with 401 when there is no authenticated user', () => {
    const req: any = {};
    const res = buildRes();
    const next = jest.fn();

    requireRole(['Manager'])(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects with 403 when the user role is not in the allowed list', () => {
    const req: any = { user: { roleName: 'Sales', isSuperAdmin: () => false } };
    const res = buildRes();
    const next = jest.fn();

    requireRole(['Manager'])(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('calls next when the user role is in the allowed list', () => {
    const req: any = { user: { roleName: 'Manager', isSuperAdmin: () => false } };
    const res = buildRes();
    const next = jest.fn();

    requireRole(['Manager'])(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('SuperAdmin bypasses the check regardless of the allowed list', () => {
    const req: any = { user: { roleName: 'SuperAdmin', isSuperAdmin: () => true } };
    const res = buildRes();
    const next = jest.fn();

    requireRole(['Manager'])(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });
});
