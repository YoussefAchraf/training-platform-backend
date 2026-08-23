import { Router } from 'express';

export const trainingRoutesDocs: Record<string, any> = {
  '/trainings': {
    get: {
      tags: ['Trainings'],
      summary: 'List trainings (e.g. RHCSA), optionally filtered by provider',
      parameters: [{ name: 'providerId', in: 'query', required: false, schema: { type: 'integer' } }],
      responses: {
        200: {
          description: 'OK',
          content: {
            'application/json': {
              schema: { type: 'array', items: { $ref: '#/components/schemas/Training' } },
            },
          },
        },
      },
    },
    post: {
      tags: ['Trainings'],
      summary: 'Create a training under a provider',
      description: 'Sales or Manager only.',
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['name', 'providerId'],
              properties: {
                name: { type: 'string', example: 'RHCSA' },
                providerId: { type: 'integer' },
                description: { type: 'string' },
                duration: { type: 'integer', description: 'A count of days or hours - see durationUnit.' },
                durationUnit: { $ref: '#/components/schemas/TrainingDurationUnit' },
              },
            },
          },
        },
      },
      responses: {
        201: { description: 'Created', content: { 'application/json': { schema: { $ref: '#/components/schemas/Training' } } } },
        400: { description: 'Validation error or provider not found', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
        403: { description: 'Not Sales or Manager' },
      },
    },
  },
  '/trainings/{id}': {
    patch: {
      tags: ['Trainings'],
      summary: 'Update a training',
      description: 'Sales or Manager only, and only for a training you created (SuperAdmin can update any).',
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                description: { type: 'string' },
                duration: { type: 'integer', description: 'A count of days or hours - see durationUnit.' },
                durationUnit: { $ref: '#/components/schemas/TrainingDurationUnit' },
              },
            },
          },
        },
      },
      responses: {
        200: { description: 'OK', content: { 'application/json': { schema: { $ref: '#/components/schemas/Training' } } } },
        400: {
          description: 'Validation error, training not found, or not the creator',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
        },
        403: { description: 'Not Sales or Manager' },
      },
    },
    delete: {
      tags: ['Trainings'],
      summary: 'Delete a training',
      description: 'Sales or Manager only, and only for a training you created (SuperAdmin can delete any). Soft delete.',
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
      responses: {
        204: { description: 'Deleted' },
        400: {
          description: 'Training not found, or not the creator',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
        },
        403: { description: 'Not Sales or Manager' },
      },
    },
  },
};

export default function trainingRoutes({ trainingController, authMiddleware, requireRole }) {
  const router = Router();

  router.get('/', authMiddleware, trainingController.list);
  router.post('/', authMiddleware, requireRole(['Sales', 'Manager']), trainingController.create);
  router.patch('/:id', authMiddleware, requireRole(['Sales', 'Manager']), trainingController.update);
  router.delete('/:id', authMiddleware, requireRole(['Sales', 'Manager']), trainingController.remove);

  return router;
};
