import sanitizeMiddleware from '../../../src/interface/middlewares/sanitizeMiddleware';

function run(body: any) {
  const req: any = { body };
  const res: any = {};
  const next = jest.fn();
  sanitizeMiddleware(req, res, next);
  expect(next).toHaveBeenCalled();
  return req.body;
}

describe('sanitizeMiddleware', () => {
  it('trims whitespace around string values', () => {
    const body = run({ name: '  Acme Corp  ' });
    expect(body.name).toBe('Acme Corp');
  });

  it('strips script tags and their content out of string fields', () => {
    const body = run({ description: 'Hello<script>alert(1)</script>World' });
    expect(body.description).toBe('HelloWorld');
  });

  it('strips other HTML tags but keeps their inner text', () => {
    const body = run({ bio: '<b>Bold</b> and <img src=x onerror=alert(1)>plain' });
    expect(body.bio).not.toContain('<b>');
    expect(body.bio).not.toContain('<img');
    expect(body.bio).toContain('Bold');
    expect(body.bio).toContain('plain');
  });

  it('recursively sanitizes nested objects and arrays', () => {
    const body = run({ trainingIds: ['  1  '], nested: { title: '<script>x</script>Clean' } });
    expect(body.trainingIds[0]).toBe('1');
    expect(body.nested.title).toBe('Clean');
  });

  it('leaves password and refreshToken fields untouched', () => {
    const body = run({ password: '  <script>P@ss w0rd</script>  ', refreshToken: '<raw-token-value>' });
    expect(body.password).toBe('  <script>P@ss w0rd</script>  ');
    expect(body.refreshToken).toBe('<raw-token-value>');
  });

  it('leaves non-string values untouched', () => {
    const body = run({ duration: 60, active: true, meta: null });
    expect(body).toEqual({ duration: 60, active: true, meta: null });
  });

  it('does nothing when there is no request body', () => {
    const req: any = {};
    const res: any = {};
    const next = jest.fn();
    sanitizeMiddleware(req, res, next);
    expect(next).toHaveBeenCalled();
  });
});
