import { Router } from 'express';

export default function sessionRoutes({ sessionController, authMiddleware, requireRole }) {
  const router = Router();

  router.get('/', authMiddleware, sessionController.list);
  router.post('/', authMiddleware, requireRole(['Sales', 'Manager']), sessionController.create);

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
