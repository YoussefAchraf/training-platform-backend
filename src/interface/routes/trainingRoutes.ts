import { Router } from 'express';

export default function trainingRoutes({ trainingController, authMiddleware, requireRole }) {
  const router = Router();

  router.get('/', authMiddleware, trainingController.list);
  router.post('/', authMiddleware, requireRole(['Sales', 'Manager']), trainingController.create);
  router.patch('/:id', authMiddleware, requireRole(['Sales', 'Manager']), trainingController.update);
  router.delete('/:id', authMiddleware, requireRole(['Sales', 'Manager']), trainingController.remove);

  return router;
};
