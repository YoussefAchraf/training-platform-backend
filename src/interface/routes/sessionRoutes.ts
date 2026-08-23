import { Router } from 'express';

export const sessionRoutesDocs: Record<string, any> = {
  '/sessions': {
    get: {
      tags: ['Sessions'],
      summary: 'List training sessions',
      description: 'Sales/Manager see every session; an Instructor sees only sessions assigned to them.',
      responses: {
        200: {
          description: 'OK',
          content: {
            'application/json': {
              schema: { type: 'array', items: { $ref: '#/components/schemas/TrainingSession' } },
            },
          },
        },
      },
    },
    post: {
      tags: ['Sessions'],
      summary: 'Create a training session',
      description: 'Sales or Manager only. Also creates the matching global calendar entry.',
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['trainingId', 'clientId', 'startDate', 'endDate'],
              properties: {
                trainingId: { type: 'integer' },
                clientId: { type: 'integer' },
                startDate: { type: 'string', format: 'date-time' },
                endDate: { type: 'string', format: 'date-time' },
              },
            },
          },
        },
      },
      responses: {
        201: { description: 'Created', content: { 'application/json': { schema: { $ref: '#/components/schemas/TrainingSession' } } } },
        400: {
          description: 'Validation error, or endDate not after startDate',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
        },
        403: { description: 'Not Sales or Manager' },
      },
    },
  },
  '/sessions/{id}': {
    patch: {
      tags: ['Sessions'],
      summary: 'Update a training session (dates only)',
      description:
        'Sales or Manager only, and only for a session you created (SuperAdmin can update any). Rejected once the session already has a survey or report attached.',
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                startDate: { type: 'string', format: 'date-time' },
                endDate: { type: 'string', format: 'date-time' },
              },
            },
          },
        },
      },
      responses: {
        200: { description: 'OK', content: { 'application/json': { schema: { $ref: '#/components/schemas/TrainingSession' } } } },
        400: {
          description:
            'Session not found, not the creator, endDate not after startDate, or the session already has a survey/report',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
        },
        403: { description: 'Not Sales or Manager' },
      },
    },
  },
  '/sessions/{id}/cancel': {
    post: {
      tags: ['Sessions'],
      summary: 'Cancel a training session',
      description:
        'Sales or Manager only, and only for a session you created (SuperAdmin can cancel any). Rejected if already cancelled, or if the session already has a survey or report attached.',
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
      responses: {
        200: { description: 'OK', content: { 'application/json': { schema: { $ref: '#/components/schemas/TrainingSession' } } } },
        400: {
          description:
            'Session not found, not the creator, already cancelled, or the session already has a survey/report',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
        },
        403: { description: 'Not Sales or Manager' },
      },
    },
  },
  '/sessions/{id}/assign-instructor': {
    post: {
      tags: ['Sessions'],
      summary: 'Assign a session to an instructor',
      description: 'Manager only (Sales cannot). Resets assignmentStatus to "pending" so the instructor can accept/refuse.',
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: { type: 'object', required: ['instructorId'], properties: { instructorId: { type: 'integer' } } },
          },
        },
      },
      responses: {
        200: { description: 'OK', content: { 'application/json': { schema: { $ref: '#/components/schemas/TrainingSession' } } } },
        403: { description: 'Not a Manager' },
      },
    },
  },
  '/sessions/{id}/respond': {
    post: {
      tags: ['Sessions'],
      summary: 'Accept or refuse an assigned session',
      description: 'Instructor only, and only for a session assigned to them.',
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: { type: 'object', required: ['decision'], properties: { decision: { type: 'string', enum: ['accept', 'refuse'] } } },
          },
        },
      },
      responses: {
        200: { description: 'OK', content: { 'application/json': { schema: { $ref: '#/components/schemas/TrainingSession' } } } },
        400: {
          description: 'Session not assigned to this instructor',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
        },
        403: { description: 'Not an Instructor' },
      },
    },
  },
  '/sessions/{id}/attendees': {
    post: {
      tags: ['Sessions'],
      summary: 'Add an attendee to a session',
      description: 'Sales or Manager only.',
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['name'],
              properties: { name: { type: 'string' }, email: { type: 'string' } },
            },
          },
        },
      },
      responses: {
        201: { description: 'Created', content: { 'application/json': { schema: { $ref: '#/components/schemas/SessionAttendee' } } } },
        403: { description: 'Not Sales or Manager' },
      },
    },
    get: {
      tags: ['Sessions'],
      summary: "List a session's attendees",
      description: 'Sales/Manager can view any session\'s attendees; an Instructor can only view attendees of a session assigned to them.\n',
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
      responses: {
        200: {
          description: 'OK',
          content: {
            'application/json': {
              schema: { type: 'array', items: { $ref: '#/components/schemas/SessionAttendee' } },
            },
          },
        },
        
        
        
        400: { description: "Not allowed to view this session's attendees, or the session does not exist" },
      },
    },
  },
};

export default function sessionRoutes({ sessionController, authMiddleware, requireRole }) {
  const router = Router();

  router.get('/', authMiddleware, sessionController.list);
  router.post('/', authMiddleware, requireRole(['Sales', 'Manager']), sessionController.create);
  router.patch('/:id', authMiddleware, requireRole(['Sales', 'Manager']), sessionController.update);
  router.post('/:id/cancel', authMiddleware, requireRole(['Sales', 'Manager']), sessionController.cancel);

  router.post(
    '/:id/assign-instructor',
    authMiddleware,
    requireRole(['Manager']),
    sessionController.assignInstructor
  );

  router.post('/:id/respond', authMiddleware, requireRole(['Instructor']), sessionController.respond);

  router.post(
    '/:id/attendees',
    authMiddleware,
    requireRole(['Sales', 'Manager']),
    sessionController.addAttendee
  );

  
  
  
  
  
  
  router.get('/:id/attendees', authMiddleware, sessionController.listAttendees);

  return router;
};
