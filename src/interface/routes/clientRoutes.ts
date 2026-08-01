import { Router } from 'express';

export default function clientRoutes({ clientController, authMiddleware, requireRole }) {
  const router = Router();

  router.get('/', authMiddleware, clientController.list);
  router.post('/', authMiddleware, requireRole(['Sales', 'Manager']), clientController.create);
  router.patch('/:id', authMiddleware, requireRole(['Sales', 'Manager']), clientController.update);
  router.delete('/:id', authMiddleware, requireRole(['Sales', 'Manager']), clientController.remove);

  return router;
};
