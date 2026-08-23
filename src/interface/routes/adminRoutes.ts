import { Router } from 'express';

export const adminRoutesDocs: Record<string, any> = {
  '/admin/users': {
    get: {
      tags: ['Admin'],
      summary: 'List every user, any status',
      description: 'SuperAdmin only. Unlike GET /auth/users/pending, includes approved/rejected/deactivated users too.',
      responses: {
        200: { description: 'OK', content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/User' } } } } },
        403: { description: 'Not a SuperAdmin' },
      },
    },
  },
  '/admin/users/{id}': {
    patch: {
      tags: ['Admin'],
      summary: "Edit another user's profile, role, or status",
      description:
        'SuperAdmin only. Refuses to change the role or status of the last remaining active SuperAdmin, to avoid locking everyone out.',
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                firstname: { type: 'string' },
                lastname: { type: 'string' },
                email: { type: 'string', format: 'email' },
                role: { type: 'string', enum: ['Sales', 'Manager', 'Instructor', 'SuperAdmin'] },
                status: { $ref: '#/components/schemas/UserStatus' },
              },
            },
          },
        },
      },
      responses: {
        200: { description: 'OK', content: { 'application/json': { schema: { $ref: '#/components/schemas/User' } } } },
        400: {
          description:
            'Validation error, user not found, or would leave zero active SuperAdmins',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
        },
        403: { description: 'Not a SuperAdmin' },
      },
    },
    delete: {
      tags: ['Admin'],
      summary: 'Deactivate a user',
      description:
        'SuperAdmin only. Soft delete (status becomes "deactivated") - also revokes every refresh token the user currently holds. Refuses to deactivate the last remaining active SuperAdmin.',
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
      responses: {
        200: { description: 'OK', content: { 'application/json': { schema: { $ref: '#/components/schemas/User' } } } },
        400: {
          description: 'User not found, already deactivated, or is the last remaining active SuperAdmin',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
        },
        403: { description: 'Not a SuperAdmin' },
      },
    },
  },
  '/admin/sessions': {
    get: {
      tags: ['Admin'],
      summary: 'Full training-session overview with training/client/instructor/creator names and attendee counts',
      description: 'SuperAdmin only.',
      responses: {
        200: {
          description: 'OK',
          content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/AdminSessionOverview' } } } },
        },
        403: { description: 'Not a SuperAdmin' },
      },
    },
  },
  '/admin/audit-log': {
    get: {
      tags: ['Admin'],
      summary: 'List audit log entries',
      description:
        'Manager or SuperAdmin. A Manager never sees entityType=User entries (and gets a 400 if they explicitly filter for them) - only a SuperAdmin can view changes made to user accounts. Capped at the 200 most recent entries.',
      parameters: [
        { name: 'entityType', in: 'query', required: false, schema: { type: 'string' }, example: 'Provider' },
        { name: 'entityId', in: 'query', required: false, schema: { type: 'integer' } },
      ],
      responses: {
        200: {
          description: 'OK',
          content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/AuditLogEntry' } } } },
        },
        400: {
          description: 'A Manager explicitly filtered for entityType=User',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
        },
        403: { description: 'Not a Manager or SuperAdmin' },
      },
    },
  },
};

export default function adminRoutes({ authController, adminController, authMiddleware, requireRole }) {
  const router = Router();

  router.get('/users', authMiddleware, requireRole(['SuperAdmin']), authController.listAllUsers);
  router.patch('/users/:id', authMiddleware, requireRole(['SuperAdmin']), authController.updateUserByAdmin);
  router.delete('/users/:id', authMiddleware, requireRole(['SuperAdmin']), authController.deactivateUser);

  router.get('/sessions', authMiddleware, requireRole(['SuperAdmin']), adminController.sessionsOverview);
  router.get('/audit-log', authMiddleware, requireRole(['Manager']), adminController.auditLog);

  return router;
};
