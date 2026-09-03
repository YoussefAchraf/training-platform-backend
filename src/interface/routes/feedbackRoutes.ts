import { Router } from 'express';

export const feedbackRoutesDocs: Record<string, any> = {
  '/feedback': {
    post: {
      tags: ['Feedback'],
      summary: 'Submit a feedback report to the Developer',
      description: 'Sales, Manager, Instructor, or SuperAdmin only - Developer accounts have no reason to submit feedback to themselves.',
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['category', 'message'],
              properties: {
                category: { type: 'string', enum: ['bug', 'enhancement', 'other'] },
                message: { type: 'string' },
              },
            },
          },
        },
      },
      responses: {
        201: { description: 'Created', content: { 'application/json': { schema: { $ref: '#/components/schemas/FeedbackReport' } } } },
        400: {
          description: 'Invalid category or missing message',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
        },
        403: { description: 'Not Sales, Manager, Instructor, or SuperAdmin' },
      },
    },
    get: {
      tags: ['Feedback'],
      summary: 'List every feedback report ever submitted',
      description: 'Developer only. Newest first, with the submitter\'s name, email, and role already joined in.',
      responses: {
        200: {
          description: 'OK',
          content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/FeedbackReport' } } } },
        },
        403: { description: 'Not Developer' },
      },
    },
  },
};

export default function feedbackRoutes({ feedbackController, authMiddleware, requireRole }) {
  const router = Router();

  router.post(
    '/',
    authMiddleware,
    requireRole(['Sales', 'Manager', 'Instructor', 'SuperAdmin']),
    feedbackController.submit
  );
  router.get('/', authMiddleware, requireRole(['Developer']), feedbackController.list);

  return router;
};
