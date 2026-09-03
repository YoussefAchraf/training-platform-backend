import { Router } from 'express';

export const authRoutesDocs: Record<string, any> = {
  '/auth/signup': {
    post: {
      tags: ['Auth'],
      summary: 'Create an account (Sales, Manager, or Instructor)',
      security: [],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['firstname', 'lastname', 'email', 'password', 'role'],
              properties: {
                firstname: { type: 'string' },
                lastname: { type: 'string' },
                email: { type: 'string', format: 'email' },
                password: { type: 'string', format: 'password' },
                role: { $ref: '#/components/schemas/Role' },
              },
            },
          },
        },
      },
      responses: {
        201: {
          description: 'Account created, status is "pending" until a Manager approves it.',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: { message: { type: 'string' }, user: { $ref: '#/components/schemas/User' } },
              },
            },
          },
        },
        400: { description: 'Validation error', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
        429: { description: 'Rate limited' },
      },
    },
  },
  '/auth/login': {
    post: {
      tags: ['Auth'],
      summary: 'Log in (Sales, Manager, Instructor) and receive an httpOnly session',
      description:
        'SuperAdmin accounts cannot log in through this endpoint - a SuperAdmin\'s correct password is rejected with the exact same "Invalid credentials" message a wrong password would produce, so the response never reveals that an email belongs to a SuperAdmin. Use /auth/admin-login instead. On success, sets three cookies: httpOnly accessToken, httpOnly refreshToken (scoped to /auth), and a JS-readable csrfToken. No tokens are returned in the response body.\n',
      security: [],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['email', 'password'],
              properties: {
                email: { type: 'string', format: 'email' },
                password: { type: 'string', format: 'password' },
              },
            },
          },
        },
      },
      responses: {
        200: {
          description: 'OK. Session cookies set via Set-Cookie.',
          content: { 'application/json': { schema: { type: 'object', properties: { user: { $ref: '#/components/schemas/User' } } } } },
        },
        401: {
          description: 'Invalid credentials, SuperAdmin account, pending, or rejected account',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
        },
        429: { description: 'Rate limited' },
      },
    },
  },
  '/auth/admin-login': {
    post: {
      tags: ['Auth'],
      summary: 'Log in as SuperAdmin',
      description:
        'Only succeeds for SuperAdmin accounts - a correct password for a non-SuperAdmin account is rejected with the same "Invalid credentials" message a wrong password would produce. Subject to a much stricter, dedicated rate limit than /auth/login. Sets the same session cookies as /auth/login on success.\n',
      security: [],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['email', 'password'],
              properties: {
                email: { type: 'string', format: 'email' },
                password: { type: 'string', format: 'password' },
              },
            },
          },
        },
      },
      responses: {
        200: {
          description: 'OK. Session cookies set via Set-Cookie.',
          content: { 'application/json': { schema: { type: 'object', properties: { user: { $ref: '#/components/schemas/User' } } } } },
        },
        401: {
          description: 'Invalid credentials, non-SuperAdmin account, pending, or rejected account',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
        },
        429: { description: 'Rate limited (much lower threshold than /auth/login)' },
      },
    },
  },
  '/auth/developer-login': {
    post: {
      tags: ['Auth'],
      summary: 'Log in as Developer',
      description:
        'Only succeeds for Developer accounts - a correct password for a non-Developer account is rejected with the same "Invalid credentials" message a wrong password would produce. Subject to a much stricter, dedicated rate limit than /auth/login. Sets the same session cookies as /auth/login on success.\n',
      security: [],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['email', 'password'],
              properties: {
                email: { type: 'string', format: 'email' },
                password: { type: 'string', format: 'password' },
              },
            },
          },
        },
      },
      responses: {
        200: {
          description: 'OK. Session cookies set via Set-Cookie.',
          content: { 'application/json': { schema: { type: 'object', properties: { user: { $ref: '#/components/schemas/User' } } } } },
        },
        401: {
          description: 'Invalid credentials, non-Developer account, pending, or rejected account',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
        },
        429: { description: 'Rate limited (much lower threshold than /auth/login)' },
      },
    },
  },
  '/auth/refresh': {
    post: {
      tags: ['Auth'],
      summary: 'Rotate the session using the httpOnly refreshToken cookie',
      description:
        "Reads the refreshToken from its httpOnly cookie (not the request body). The presented refresh token is revoked immediately, whether or not the call succeeds after that point. Requires a valid X-CSRF-Token header (checked explicitly here since this route runs before/without authMiddleware, by design, so an already-expired access token doesn't block refreshing).\n",
      security: [],
      parameters: [{ $ref: '#/components/parameters/CsrfHeader' }],
      responses: {
        200: { description: 'OK. New session cookies set via Set-Cookie.' },
        401: { description: 'Invalid, expired, or already-used refresh token' },
        403: { description: 'Missing/invalid CSRF token' },
        429: { description: 'Rate limited' },
      },
    },
  },
  '/auth/logout': {
    post: {
      tags: ['Auth'],
      summary: 'Revoke the current session',
      description: 'Reads the refreshToken from its httpOnly cookie and revokes it, then clears all session cookies.',
      parameters: [{ $ref: '#/components/parameters/CsrfHeader' }],
      responses: {
        200: { description: "Always succeeds if authenticated, even if the token was already invalid (doesn't leak validity)" },
        401: { description: 'Missing/invalid access token' },
        403: { description: 'Missing/invalid CSRF token' },
      },
    },
  },
  '/auth/me': {
    get: {
      tags: ['Auth'],
      summary: 'Get the currently authenticated user',
      description: 'Used by the frontend on load to bootstrap session state from the httpOnly cookie (no tokens are readable client-side).',
      responses: {
        200: {
          description: 'OK',
          content: { 'application/json': { schema: { type: 'object', properties: { user: { $ref: '#/components/schemas/User' } } } } },
        },
        401: { description: 'Missing/invalid access token' },
      },
    },
    patch: {
      tags: ['Auth'],
      summary: 'Update my own profile (firstname/lastname), or mark the guided tour as seen',
      description:
        'Response body is the updated User object directly, not wrapped in { user }, unlike GET /auth/me. Passing hasSeenTour: true (typically fired the moment the dashboard auto-launches its guided tour) does not create an audit-log entry - only firstname/lastname edits do.\n',
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                firstname: { type: 'string' },
                lastname: { type: 'string' },
                hasSeenTour: { type: 'boolean' },
              },
            },
          },
        },
      },
      responses: {
        200: { description: 'OK', content: { 'application/json': { schema: { $ref: '#/components/schemas/User' } } } },
        401: { description: 'Missing/invalid access token' },
      },
    },
  },
  '/auth/reset-password': {
    post: {
      tags: ['Auth'],
      summary: 'Complete a password reset using the token from a reset email',
      description:
        'Public - the token (not a session) is what authorizes this call, exactly like the survey-submission flow is authorized by knowing a session ID rather than logging in. Single-use: the token is consumed the moment this succeeds, whether or not it was already close to expiring. Revokes every refresh token the account holds and sends a confirmation email.\n',
      security: [],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['token', 'newPassword'],
              properties: {
                token: { type: 'string' },
                newPassword: { type: 'string', format: 'password', description: 'At least 10 characters, with at least one letter and one number.' },
              },
            },
          },
        },
      },
      responses: {
        200: { description: 'OK' },
        400: {
          description: 'Token invalid/expired/already used, or newPassword too weak',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
        },
        429: { description: 'Rate limited' },
      },
    },
  },
  '/auth/me/password': {
    patch: {
      tags: ['Auth'],
      summary: 'Change my own password',
      description:
        "Requires the current password even though the caller is already authenticated, so a hijacked-but-idle session can't silently take over the account. On success, every OTHER session for this account is signed out (a fresh session is issued for the device that made this call, via updated Set-Cookie headers) and a confirmation email is sent.\n",
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['currentPassword', 'newPassword'],
              properties: {
                currentPassword: { type: 'string', format: 'password' },
                newPassword: { type: 'string', format: 'password', description: 'At least 10 characters, with at least one letter and one number. Must differ from currentPassword.' },
              },
            },
          },
        },
      },
      responses: {
        200: { description: 'OK. New session cookies set via Set-Cookie.' },
        400: {
          description: 'Current password incorrect, newPassword too weak, or newPassword equals currentPassword',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
        },
        401: { description: 'Missing/invalid access token' },
        429: { description: 'Rate limited' },
      },
    },
  },
  '/auth/service-token': {
    get: {
      tags: ['Auth'],
      summary: 'Mint a short-lived bearer token for cross-origin service calls',
      description:
        "The main session lives entirely in the httpOnly accessToken cookie, which by design a cross-origin service (e.g. the chatbot's n8n webhook host) never receives. This returns an ordinary bearer JWT, identical in shape/expiry to the cookie's, meant to be used immediately and held only in memory client-side (never persisted to localStorage) for that one cross-origin call.\n",
      responses: {
        200: {
          description: 'OK',
          content: { 'application/json': { schema: { type: 'object', properties: { accessToken: { type: 'string' } } } } },
        },
        401: { description: 'Missing/invalid access token' },
      },
    },
  },
  '/auth/roles': {
    get: {
      tags: ['Auth'],
      summary: 'List roles (id + name)',
      description:
        'User responses expose roleId, not a role name string (see the User schema) - use this to resolve a roleId back to a display name. Ids are whatever the roles table actually assigned them; do not assume a fixed 1..4 sequence.\n',
      responses: {
        200: {
          description: 'OK',
          content: {
            'application/json': {
              schema: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'integer', example: 2 },
                    name: { type: 'string', enum: ['Sales', 'Manager', 'Instructor', 'SuperAdmin'], example: 'Manager' },
                  },
                },
              },
            },
          },
        },
        401: { description: 'Missing/invalid access token' },
      },
    },
  },
  '/auth/users/pending': {
    get: {
      tags: ['Auth'],
      summary: 'List users awaiting approval',
      description: 'Manager only.',
      responses: {
        200: {
          description: 'OK',
          content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/User' } } } },
        },
        401: { description: 'Not authenticated' },
        403: { description: 'Not a Manager' },
      },
    },
  },
  '/auth/users/{id}/approve': {
    post: {
      tags: ['Auth'],
      summary: 'Approve a pending user',
      description: 'Manager only. Sends an approval email and points the user to the login page.',
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
      responses: {
        200: { description: 'OK', content: { 'application/json': { schema: { $ref: '#/components/schemas/User' } } } },
        403: { description: 'Not a Manager' },
      },
    },
  },
  '/auth/users/{id}/reject': {
    post: {
      tags: ['Auth'],
      summary: 'Reject a pending user',
      description: 'Manager only. Also revokes every refresh token the user currently holds.',
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
      responses: {
        200: { description: 'OK', content: { 'application/json': { schema: { $ref: '#/components/schemas/User' } } } },
        403: { description: 'Not a Manager' },
      },
    },
  },
};

export default function authRoutes({
  authController,
  authMiddleware,
  optionalAuthMiddleware,
  requireRole,
  authLimiter,
  adminLoginLimiter,
  developerLoginLimiter,
}) {
  const router = Router();

  router.post('/signup', authLimiter, authController.signup);
  router.post('/login', authLimiter, authController.login);
  router.post('/admin-login', adminLoginLimiter, authController.adminLogin);
  router.post('/developer-login', developerLoginLimiter, authController.developerLogin);
  router.post('/refresh', authLimiter, authController.refresh);
  router.post('/logout', authMiddleware, authController.logout);
  
  
  
  router.get('/me', optionalAuthMiddleware, authController.me);
  router.patch('/me', authMiddleware, authController.updateMe);
  router.patch('/me/password', authMiddleware, authLimiter, authController.changePassword);
  router.post('/reset-password', authLimiter, authController.resetPassword);
  router.get('/service-token', authMiddleware, authController.serviceToken);
  router.get('/roles', authMiddleware, authController.listRoles);

  router.get('/users/pending', authMiddleware, requireRole(['Manager']), authController.listPending);
  router.post('/users/:id/approve', authMiddleware, requireRole(['Manager']), authController.approve);
  router.post('/users/:id/reject', authMiddleware, requireRole(['Manager']), authController.reject);

  return router;
}
