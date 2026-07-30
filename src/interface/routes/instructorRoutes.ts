import { Router } from 'express';

export default function instructorRoutes({ instructorController, authMiddleware, requireRole }) {
  const router = Router();

  router.get('/', authMiddleware, requireRole(['Manager', 'Sales']), instructorController.list);

  router.get('/me', authMiddleware, requireRole(['Instructor']), instructorController.getMe);
  router.patch('/me', authMiddleware, requireRole(['Instructor']), instructorController.updateMe);

  router.patch('/:id', authMiddleware, requireRole(['Manager']), instructorController.updateByManager);

  return router;
};
