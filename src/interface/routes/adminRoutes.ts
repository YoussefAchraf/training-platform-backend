import { Router } from 'express';

export default function adminRoutes({ authController, authMiddleware, requireRole }) {
  const router = Router();

  router.get('/users', authMiddleware, requireRole(['SuperAdmin']), authController.listAllUsers);
  router.patch('/users/:id', authMiddleware, requireRole(['SuperAdmin']), authController.updateUserByAdmin);
  router.delete('/users/:id', authMiddleware, requireRole(['SuperAdmin']), authController.deactivateUser);

  return router;
};
