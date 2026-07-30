import { Router } from 'express';

export default function clientRoutes({ clientController, authMiddleware, requireRole }) {
  const router = Router();

  router.get('/', authMiddleware, clientController.list);
  router.post('/', authMiddleware, requireRole(['Sales', 'Manager']), clientController.create);

  return router;
};
