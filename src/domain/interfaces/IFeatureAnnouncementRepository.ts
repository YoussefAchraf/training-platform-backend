import { notImplemented } from './notImplemented';

class IFeatureAnnouncementRepository {
  async create(announcement): Promise<any> { notImplemented('IFeatureAnnouncementRepository', 'create'); }
  async findById(id): Promise<any> { notImplemented('IFeatureAnnouncementRepository', 'findById'); }
  async listAllWithRatings(): Promise<any> { notImplemented('IFeatureAnnouncementRepository', 'listAllWithRatings'); }
  async listPendingForUser({ userId, role, joinedAt }): Promise<any> { notImplemented('IFeatureAnnouncementRepository', 'listPendingForUser'); }
  async rate({ announcementId, userId, stars }): Promise<any> { notImplemented('IFeatureAnnouncementRepository', 'rate'); }
}

export { IFeatureAnnouncementRepository };
