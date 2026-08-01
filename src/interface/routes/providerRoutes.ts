import { Router } from 'express';

export default function providerRoutes({ providerController, authMiddleware, requireRole }) {
  const router = Router();

  router.get('/', authMiddleware, providerController.list);
  router.post('/', authMiddleware, requireRole(['Sales', 'Manager']), providerController.create);
  router.patch('/:id', authMiddleware, requireRole(['Sales', 'Manager']), providerController.update);
  router.delete('/:id', authMiddleware, requireRole(['Sales', 'Manager']), providerController.remove);

  return router;
};
