import { Router } from 'express';

export default function authRoutes({ authController, authMiddleware, requireRole, authLimiter }) {
  const router = Router();

  router.post('/signup', authLimiter, authController.signup);
  router.post('/login', authLimiter, authController.login);
  router.post('/refresh', authLimiter, authController.refresh);
  router.post('/logout', authMiddleware, authController.logout);

  router.get('/users/pending', authMiddleware, requireRole(['Manager']), authController.listPending);
  router.post('/users/:id/approve', authMiddleware, requireRole(['Manager']), authController.approve);
  router.post('/users/:id/reject', authMiddleware, requireRole(['Manager']), authController.reject);

  return router;
}
