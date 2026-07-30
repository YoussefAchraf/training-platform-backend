import { notImplemented } from './notImplemented';

class ISurveyRepository {
  async create(survey): Promise<any> { notImplemented('ISurveyRepository', 'create'); }
  async listBySession(sessionId): Promise<any> { notImplemented('ISurveyRepository', 'listBySession'); }
  async getSessionAverages(sessionId): Promise<any> { notImplemented('ISurveyRepository', 'getSessionAverages'); }
}

export { ISurveyRepository };
