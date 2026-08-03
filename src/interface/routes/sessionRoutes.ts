import { Router } from 'express';

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

  return router;
};
