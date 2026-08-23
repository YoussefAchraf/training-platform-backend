import { Router } from 'express';

export const clientRoutesDocs: Record<string, any> = {
  '/clients': {
    get: {
      tags: ['Clients'],
      summary: 'List clients',
      responses: {
        200: {
          description: 'OK',
          content: {
            'application/json': {
              schema: { type: 'array', items: { $ref: '#/components/schemas/Client' } },
            },
          },
        },
      },
    },
    post: {
      tags: ['Clients'],
      summary: 'Add a client',
      description: 'Sales or Manager only.',
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['companyName'],
              properties: {
                companyName: { type: 'string', example: 'Acme Corp' },
                email: { type: 'string' },
                phone: { type: 'string' },
              },
            },
          },
        },
      },
      responses: {
        201: { description: 'Created', content: { 'application/json': { schema: { $ref: '#/components/schemas/Client' } } } },
        400: { description: 'Validation error', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
        403: { description: 'Not Sales or Manager' },
      },
    },
  },
  '/clients/{id}': {
    patch: {
      tags: ['Clients'],
      summary: 'Update a client',
      description: 'Sales or Manager only, and only for a client you created (SuperAdmin can update any).',
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                companyName: { type: 'string' },
                email: { type: 'string' },
                phone: { type: 'string' },
              },
            },
          },
        },
      },
      responses: {
        200: { description: 'OK', content: { 'application/json': { schema: { $ref: '#/components/schemas/Client' } } } },
        400: {
          description: 'Validation error, client not found, or not the creator',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
        },
        403: { description: 'Not Sales or Manager' },
      },
    },
    delete: {
      tags: ['Clients'],
      summary: 'Delete a client',
      description: 'Sales or Manager only, and only for a client you created (SuperAdmin can delete any). Soft delete.',
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
      responses: {
        204: { description: 'Deleted' },
        400: {
          description: 'Client not found, or not the creator',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
        },
        403: { description: 'Not Sales or Manager' },
      },
    },
  },
};

export default function clientRoutes({ clientController, authMiddleware, requireRole }) {
  const router = Router();

  router.get('/', authMiddleware, clientController.list);
  router.post('/', authMiddleware, requireRole(['Sales', 'Manager']), clientController.create);
  router.patch('/:id', authMiddleware, requireRole(['Sales', 'Manager']), clientController.update);
  router.delete('/:id', authMiddleware, requireRole(['Sales', 'Manager']), clientController.remove);

  return router;
};
