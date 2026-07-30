import { Router } from 'express';

export default function calendarRoutes({ calendarController, authMiddleware, requireRole }) {
  const router = Router();

  
  router.get('/global', authMiddleware, requireRole(['Sales', 'Manager']), calendarController.listGlobal);
  router.patch('/global/:id', authMiddleware, requireRole(['Sales', 'Manager']), calendarController.updateGlobal);
  router.delete('/global/:id', authMiddleware, requireRole(['Sales', 'Manager']), calendarController.deleteGlobal);

  
  router.get('/mine', authMiddleware, requireRole(['Instructor']), calendarController.listMine);

  return router;
};
