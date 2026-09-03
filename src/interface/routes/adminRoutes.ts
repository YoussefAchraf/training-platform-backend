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
  '/admin/users/{id}/purge': {
    delete: {
      tags: ['Admin'],
      summary: 'Permanently delete a user',
      description:
        "SuperAdmin only. Irreversible - unlike DELETE /admin/users/{id} (which only deactivates), this removes the account row entirely. Requires the account to already be deactivated first, and refuses to target the requester's own account. Trainings/sessions/providers/clients/feedback/announcements this user created are kept, just detached (created_by/submitted_by becomes null) - business records aren't deleted. If they were an assigned Instructor, sessions/surveys referencing them are unassigned (instructor_id becomes null), not deleted. This user's audit log footprint is anonymized rather than deleted: entries where they were the actor now show as from a deleted user instead of System, and entries about their own account (signup, approval, edits) have their name/email scrubbed - the audit trail itself is preserved.\n",
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
      responses: {
        200: { description: 'OK', content: { 'application/json': { schema: { type: 'object', properties: { id: { type: 'integer' }, deleted: { type: 'boolean' } } } } } },
        400: {
          description: 'User not found, not yet deactivated, or is the requester\'s own account',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
        },
        403: { description: 'Not a SuperAdmin' },
      },
    },
  },
  '/admin/users/{id}/send-password-reset': {
    post: {
      tags: ['Admin'],
      summary: "Email a password reset link for another user's account",
      description:
        "SuperAdmin only, and cannot target another SuperAdmin account. Sends a single-use, short-lived reset link to the account's own email and immediately revokes every refresh token that account currently holds, signing out any active sessions as a precaution. No password is ever generated or transmitted by this endpoint - the emailed link only lets the recipient set their own new one, via POST /auth/reset-password.\n",
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
      responses: {
        200: { description: 'OK - email sent' },
        400: {
          description: 'User not found, target is a SuperAdmin, or the email failed to send',
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
        { name: 'startDate', in: 'query', required: false, schema: { type: 'string', format: 'date-time' }, description: 'Only entries created at or after this instant' },
        { name: 'endDate', in: 'query', required: false, schema: { type: 'string', format: 'date-time' }, description: 'Only entries created at or before this instant' },
        {
          name: 'roleName',
          in: 'query',
          required: false,
          schema: { type: 'string', enum: ['Sales', 'Manager', 'Instructor', 'SuperAdmin'] },
          description: "Only entries whose actor holds this role",
        },
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
  router.delete('/users/:id/purge', authMiddleware, requireRole(['SuperAdmin']), authController.hardDeleteUser);
  router.post('/users/:id/send-password-reset', authMiddleware, requireRole(['SuperAdmin']), authController.sendPasswordReset);

  router.get('/sessions', authMiddleware, requireRole(['SuperAdmin']), adminController.sessionsOverview);
  router.get('/audit-log', authMiddleware, requireRole(['Manager']), adminController.auditLog);

  return router;
};
