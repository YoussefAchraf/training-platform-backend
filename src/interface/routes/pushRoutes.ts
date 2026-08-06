import { Router } from 'express';



export default function pushRoutes({ pushController, authMiddleware }) {
  const router = Router();

  router.post('/subscribe', authMiddleware, pushController.subscribe);
  router.post('/unsubscribe', authMiddleware, pushController.unsubscribe);

  return router;
};
