import { Router } from 'express';

export const providerRoutesDocs: Record<string, any> = {
  '/providers': {
    get: {
      tags: ['Providers'],
      summary: 'List all providers (e.g. Red Hat, Linux Foundation, CompTIA, SUSE, Oracle)',
      responses: {
        200: {
          description: 'OK',
          content: {
            'application/json': {
              schema: { type: 'array', items: { $ref: '#/components/schemas/Provider' } },
            },
          },
        },
      },
    },
    post: {
      tags: ['Providers'],
      summary: 'Add a provider',
      description: 'Sales or Manager only.',
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['name'],
              properties: {
                name: { type: 'string', example: 'Red Hat' },
                description: { type: 'string' },
                logoUrl: { type: 'string', example: 'https://example.com/redhat-logo.svg' },
              },
            },
          },
        },
      },
      responses: {
        201: { description: 'Created', content: { 'application/json': { schema: { $ref: '#/components/schemas/Provider' } } } },
        400: { description: 'Validation error or duplicate name', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
        403: { description: 'Not Sales or Manager' },
      },
    },
  },
  '/providers/{id}': {
    patch: {
      tags: ['Providers'],
      summary: 'Update a provider',
      description: 'Sales or Manager only, and only for a provider you created (SuperAdmin can update any).',
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                description: { type: 'string' },
                logoUrl: { type: 'string', example: 'https://example.com/redhat-logo.svg' },
              },
            },
          },
        },
      },
      responses: {
        200: { description: 'OK', content: { 'application/json': { schema: { $ref: '#/components/schemas/Provider' } } } },
        400: {
          description: 'Validation error, provider not found, or not the creator',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
        },
        403: { description: 'Not Sales or Manager' },
      },
    },
    delete: {
      tags: ['Providers'],
      summary: 'Delete a provider',
      description: 'Sales or Manager only, and only for a provider you created (SuperAdmin can delete any). Soft delete.',
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
      responses: {
        204: { description: 'Deleted' },
        400: {
          description: 'Provider not found, or not the creator',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
        },
        403: { description: 'Not Sales or Manager' },
      },
    },
  },
};

export default function providerRoutes({ providerController, authMiddleware, requireRole }) {
  const router = Router();

  router.get('/', authMiddleware, providerController.list);
  router.post('/', authMiddleware, requireRole(['Sales', 'Manager']), providerController.create);
  router.patch('/:id', authMiddleware, requireRole(['Sales', 'Manager']), providerController.update);
  router.delete('/:id', authMiddleware, requireRole(['Sales', 'Manager']), providerController.remove);

  return router;
};
