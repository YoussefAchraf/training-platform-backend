import { Router } from 'express';

export const reportRoutesDocs: Record<string, any> = {
  '/reports/{sessionId}': {
    get: {
      tags: ['Reports'],
      summary: "Get a session's report",
      description: 'Sales, Manager, or Instructor.',
      parameters: [{ name: 'sessionId', in: 'path', required: true, schema: { type: 'integer' } }],
      responses: {
        200: { description: 'OK', content: { 'application/json': { schema: { $ref: '#/components/schemas/Report' } } } },
        404: {
          description: 'No report yet for this session',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
        },
      },
    },
  },
  '/reports/{sessionId}/pdf': {
    get: {
      tags: ['Reports'],
      summary: "Download a session's report as a PDF",
      description: 'Sales, Manager, or Instructor.',
      parameters: [{ name: 'sessionId', in: 'path', required: true, schema: { type: 'integer' } }],
      responses: {
        200: {
          description: 'OK',
          content: { 'application/pdf': { schema: { type: 'string', format: 'binary' } } },
        },
        404: {
          description: 'Report not yet generated for this session, or session not found',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
        },
      },
    },
  },
  '/reports/{sessionId}/generate': {
    post: {
      tags: ['Reports'],
      summary: 'Manually trigger report generation for a session',
      description:
        'Sales or Manager only. Normally unnecessary - a report auto-generates once every attendee submits a survey, or via the scheduled job REPORT_AUTO_GENERATE_AFTER_MINUTES after the session ends (default 60 minutes).\n',
      parameters: [{ name: 'sessionId', in: 'path', required: true, schema: { type: 'integer' } }],
      responses: {
        
        
        201: { description: 'Created', content: { 'application/json': { schema: { $ref: '#/components/schemas/Report' } } } },
        403: { description: 'Not Sales or Manager' },
      },
    },
  },
};

export default function reportRoutes({ reportController, authMiddleware, requireRole }) {
  const router = Router();

  router.get('/:sessionId', authMiddleware, requireRole(['Sales', 'Manager', 'Instructor']), reportController.get);
  router.get(
    '/:sessionId/pdf',
    authMiddleware,
    requireRole(['Sales', 'Manager', 'Instructor']),
    reportController.downloadPdf
  );
  router.post(
    '/:sessionId/generate',
    authMiddleware,
    requireRole(['Sales', 'Manager']),
    reportController.generate
  );

  return router;
};
