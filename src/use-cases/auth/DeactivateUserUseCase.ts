import { USER_STATUS } from '../../domain/entities/User';

class DeactivateUserUseCase {
  userRepository: any;
  auditLogRepository: any;
  refreshTokenStore: any;

  constructor({ userRepository, auditLogRepository, refreshTokenStore }) {
    this.userRepository = userRepository;
    this.auditLogRepository = auditLogRepository;
    this.refreshTokenStore = refreshTokenStore;
  }

  async execute({ requester, targetUserId }) {
    if (!requester.isSuperAdmin()) {
      throw new Error('Only a SuperAdmin can deactivate a user');
    }

    const target = await this.userRepository.findById(targetUserId);
    if (!target) {
      throw new Error('User not found');
    }

    if (target.status === USER_STATUS.DEACTIVATED) {
      throw new Error('User is already deactivated');
    }

    if (target.isSuperAdmin()) {
      const activeCount = await this.userRepository.countActiveSuperAdmins();
      if (activeCount <= 1) {
        throw new Error('Cannot deactivate the last remaining SuperAdmin');
      }
    }

    const updated = await this.userRepository.update(targetUserId, { status: USER_STATUS.DEACTIVATED });

    await this.auditLogRepository.create({
      actorId: requester.id,
      action: 'delete',
      entityType: 'User',
      entityId: targetUserId,
      before: target.toSafeJSON(),
      after: updated.toSafeJSON(),
    });

    await this.refreshTokenStore.revokeAllForUser(targetUserId);

    return updated.toSafeJSON();
  }
}

export { DeactivateUserUseCase };
