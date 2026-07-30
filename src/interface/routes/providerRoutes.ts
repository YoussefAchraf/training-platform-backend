import { Router } from 'express';

export default function providerRoutes({ providerController, authMiddleware, requireRole }) {
  const router = Router();

  router.get('/', authMiddleware, providerController.list);
  router.post('/', authMiddleware, requireRole(['Sales', 'Manager']), providerController.create);

  return router;
};
