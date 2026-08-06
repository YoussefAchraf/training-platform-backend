import { Router } from 'express';

export default function authRoutes({
  authController,
  authMiddleware,
  optionalAuthMiddleware,
  requireRole,
  authLimiter,
  adminLoginLimiter,
}) {
  const router = Router();

  router.post('/signup', authLimiter, authController.signup);
  router.post('/login', authLimiter, authController.login);
  router.post('/admin-login', adminLoginLimiter, authController.adminLogin);
  router.post('/refresh', authLimiter, authController.refresh);
  router.post('/logout', authMiddleware, authController.logout);
  
  
  
  router.get('/me', optionalAuthMiddleware, authController.me);
  router.patch('/me', authMiddleware, authController.updateMe);
  router.get('/service-token', authMiddleware, authController.serviceToken);
  router.get('/roles', authMiddleware, authController.listRoles);

  router.get('/users/pending', authMiddleware, requireRole(['Manager']), authController.listPending);
  router.post('/users/:id/approve', authMiddleware, requireRole(['Manager']), authController.approve);
  router.post('/users/:id/reject', authMiddleware, requireRole(['Manager']), authController.reject);

  return router;
}
