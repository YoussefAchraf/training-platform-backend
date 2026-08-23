import { Router } from 'express';

export const calendarRoutesDocs: Record<string, any> = {
  '/calendar/global': {
    get: {
      tags: ['Calendar'],
      summary: 'List the global calendar',
      description: 'Sales or Manager only.',
      responses: {
        200: {
          description: 'OK',
          content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/CalendarEvent' } } } },
        },
        403: { description: 'Not Sales or Manager' },
      },
    },
  },
  '/calendar/global/{id}': {
    patch: {
      tags: ['Calendar'],
      summary: 'Update a global calendar event',
      description: 'Sales or Manager only.',
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                eventDate: { type: 'string', format: 'date-time' },
                endDate: { type: 'string', format: 'date-time' },
                title: { type: 'string' },
              },
            },
          },
        },
      },
      responses: {
        200: { description: 'OK', content: { 'application/json': { schema: { $ref: '#/components/schemas/CalendarEvent' } } } },
        403: { description: 'Not Sales or Manager' },
      },
    },
    delete: {
      tags: ['Calendar'],
      summary: 'Delete a global calendar event',
      description: 'Sales or Manager only.',
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
      responses: {
        200: { description: 'OK' },
        403: { description: 'Not Sales or Manager' },
      },
    },
  },
  '/calendar/mine': {
    get: {
      tags: ['Calendar'],
      summary: 'List my own calendar',
      description: 'Instructor only. Read-only, pre-filtered to sessions assigned to this instructor.',
      responses: {
        200: {
          description: 'OK',
          content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/CalendarEvent' } } } },
        },
        403: { description: 'Not an Instructor' },
      },
    },
  },
};

export default function calendarRoutes({ calendarController, authMiddleware, requireRole }) {
  const router = Router();

  
  router.get('/global', authMiddleware, requireRole(['Sales', 'Manager']), calendarController.listGlobal);
  router.patch('/global/:id', authMiddleware, requireRole(['Sales', 'Manager']), calendarController.updateGlobal);
  router.delete('/global/:id', authMiddleware, requireRole(['Sales', 'Manager']), calendarController.deleteGlobal);

  
  router.get('/mine', authMiddleware, requireRole(['Instructor']), calendarController.listMine);

  return router;
};
