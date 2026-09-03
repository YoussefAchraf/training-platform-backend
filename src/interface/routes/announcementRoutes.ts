import { Router } from 'express';

export const announcementRoutesDocs: Record<string, any> = {
  '/announcements': {
    post: {
      tags: ['Announcements'],
      summary: 'Publish a feature announcement to one or more roles',
      description:
        'Developer only. Publishes immediately - there is no draft state. targetRoles can be any of Sales, Manager, Instructor, SuperAdmin (never Developer itself).\n',
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['title', 'description', 'targetRoles'],
              properties: {
                title: { type: 'string' },
                description: { type: 'string' },
                targetRoles: {
                  type: 'array',
                  items: { type: 'string', enum: ['Sales', 'Manager', 'Instructor', 'SuperAdmin'] },
                },
              },
            },
          },
        },
      },
      responses: {
        201: { description: 'Created', content: { 'application/json': { schema: { $ref: '#/components/schemas/FeatureAnnouncement' } } } },
        400: {
          description: 'Missing title/description, or targetRoles empty/invalid',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
        },
        403: { description: 'Not Developer' },
      },
    },
    get: {
      tags: ['Announcements'],
      summary: 'List every published announcement, with its star ratings',
      description:
        "Developer only. Each entry includes an overall average + rating count, plus a per-role breakdown (average and count for each role that has actually rated it so far).\n",
      responses: {
        200: {
          description: 'OK',
          content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/FeatureAnnouncementWithRatings' } } } },
        },
        403: { description: 'Not Developer' },
      },
    },
  },
  '/announcements/mine': {
    get: {
      tags: ['Announcements'],
      summary: 'List announcements targeted at my role that I have not rated yet',
      description:
        'Sales, Manager, Instructor, or SuperAdmin only. Oldest first, and only announcements published since my account was created - a brand-new account is never handed a backlog of everything the role has ever been sent. Drives the mandatory-rating popup.\n',
      responses: {
        200: {
          description: 'OK',
          content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/FeatureAnnouncement' } } } },
        },
      },
    },
  },
  '/announcements/{id}/rate': {
    patch: {
      tags: ['Announcements'],
      summary: 'Rate a feature announcement 1-5 stars',
      description:
        "Sales, Manager, Instructor, or SuperAdmin only, and only for an announcement actually targeted at my role. Idempotent - rating the same announcement again updates the existing rating rather than creating a second one.\n",
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: { type: 'object', required: ['stars'], properties: { stars: { type: 'integer', minimum: 1, maximum: 5 } } },
          },
        },
      },
      responses: {
        200: { description: 'OK' },
        400: {
          description: 'stars out of range, announcement not found, or not targeted at my role',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
        },
      },
    },
  },
};

export default function announcementRoutes({ announcementController, authMiddleware, requireRole }) {
  const router = Router();

  router.post('/', authMiddleware, requireRole(['Developer']), announcementController.create);
  router.get('/', authMiddleware, requireRole(['Developer']), announcementController.list);
  router.get(
    '/mine',
    authMiddleware,
    requireRole(['Sales', 'Manager', 'Instructor', 'SuperAdmin']),
    announcementController.listMine
  );
  router.patch(
    '/:id/rate',
    authMiddleware,
    requireRole(['Sales', 'Manager', 'Instructor', 'SuperAdmin']),
    announcementController.rate
  );

  return router;
};
