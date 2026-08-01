import { Router } from 'express';

export default function adminRoutes({ authController, adminController, authMiddleware, requireRole }) {
  const router = Router();

  router.get('/users', authMiddleware, requireRole(['SuperAdmin']), authController.listAllUsers);
  router.patch('/users/:id', authMiddleware, requireRole(['SuperAdmin']), authController.updateUserByAdmin);
  router.delete('/users/:id', authMiddleware, requireRole(['SuperAdmin']), authController.deactivateUser);

  router.get('/sessions', authMiddleware, requireRole(['SuperAdmin']), adminController.sessionsOverview);
  router.get('/audit-log', authMiddleware, requireRole(['Manager']), adminController.auditLog);

  return router;
};
