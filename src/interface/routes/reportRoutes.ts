import { Router } from 'express';

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
