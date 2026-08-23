import { Router } from 'express';

export const pushRoutesDocs: Record<string, any> = {
  '/push/subscribe': {
    post: {
      tags: ['Push'],
      summary: 'Register a browser push subscription for the current user',
      description: 'Best-effort: also immediately sends a confirmation push notification; a failure there does not fail the request.',
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['endpoint', 'keys'],
              properties: {
                endpoint: { type: 'string', example: 'https://fcm.googleapis.com/fcm/send/...' },
                keys: {
                  type: 'object',
                  required: ['p256dh', 'auth'],
                  properties: { p256dh: { type: 'string' }, auth: { type: 'string' } },
                },
              },
            },
          },
        },
      },
      responses: {
        201: { description: 'Created', content: { 'application/json': { schema: { $ref: '#/components/schemas/PushSubscription' } } } },
        400: {
          description: 'endpoint or keys missing/invalid',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
        },
      },
    },
  },
  '/push/unsubscribe': {
    post: {
      tags: ['Push'],
      summary: 'Remove a browser push subscription for the current user',
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: { type: 'object', required: ['endpoint'], properties: { endpoint: { type: 'string' } } },
          },
        },
      },
      responses: {
        200: {
          description: 'OK',
          content: { 'application/json': { schema: { type: 'object', properties: { message: { type: 'string', example: 'Unsubscribed' } } } } },
        },
        400: {
          description: 'endpoint missing',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
        },
      },
    },
  },
};

export default function pushRoutes({ pushController, authMiddleware }) {
  const router = Router();

  router.post('/subscribe', authMiddleware, pushController.subscribe);
  router.post('/unsubscribe', authMiddleware, pushController.unsubscribe);

  return router;
};
