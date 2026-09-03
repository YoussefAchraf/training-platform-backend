import { ROLES } from '../../domain/entities/User';

const TARGETABLE_ROLES = [ROLES.SALES, ROLES.MANAGER, ROLES.INSTRUCTOR, ROLES.SUPER_ADMIN];

class CreateFeatureAnnouncementUseCase {
  announcementRepository: any;

  constructor({ announcementRepository }) {
    this.announcementRepository = announcementRepository;
  }

  async execute({ requester, title, description, targetRoles }: { requester: any; title: any; description: any; targetRoles: any }) {
    if (!requester.isDeveloper()) {
      throw new Error('Only Developer can publish feature announcements');
    }

    if (!title || !title.trim()) {
      throw new Error('title is required');
    }

    if (!description || !description.trim()) {
      throw new Error('description is required');
    }

    if (!Array.isArray(targetRoles) || targetRoles.length === 0) {
      throw new Error('targetRoles must be a non-empty array');
    }

    const invalidRole = targetRoles.find((role) => !TARGETABLE_ROLES.includes(role));
    if (invalidRole) {
      throw new Error(`targetRoles must only contain: ${TARGETABLE_ROLES.join(', ')}`);
    }

    const uniqueTargetRoles = [...new Set(targetRoles)];

    return this.announcementRepository.create({
      createdBy: requester.id,
      title: title.trim(),
      description: description.trim(),
      targetRoles: uniqueTargetRoles,
    });
  }
}

export { CreateFeatureAnnouncementUseCase };
