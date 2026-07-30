import { Router } from 'express';

export default function surveyRoutes({ surveyController, authMiddleware, requireRole }) {
  const router = Router();

  
  router.get(
    '/:sessionId/qr-code',
    authMiddleware,
    requireRole(['Instructor']),
    surveyController.generateQR
  );

  
  router.get('/:sessionId/form', surveyController.getSurveyInfo);
  router.post('/:sessionId/submit', surveyController.submit);

  return router;
};
