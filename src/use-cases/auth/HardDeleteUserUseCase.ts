import { USER_STATUS } from '../../domain/entities/User';

class HardDeleteUserUseCase {
  userRepository: any;
  auditLogRepository: any;

  constructor({ userRepository, auditLogRepository }) {
    this.userRepository = userRepository;
    this.auditLogRepository = auditLogRepository;
  }

  async execute({ requester, targetUserId }) {
    if (!requester.isSuperAdmin()) {
      throw new Error('Only a SuperAdmin can permanently delete a user');
    }

    if (requester.id === targetUserId) {
      throw new Error('Cannot permanently delete your own account');
    }

    const target = await this.userRepository.findById(targetUserId);
    if (!target) {
      throw new Error('User not found');
    }

    if (target.status !== USER_STATUS.DEACTIVATED) {
      throw new Error('Only a deactivated user can be permanently deleted - deactivate the account first');
    }

    
    
    
    await this.auditLogRepository.redactUserEntries(targetUserId);

    await this.userRepository.hardDelete(targetUserId);

    
    
    
    await this.auditLogRepository.create({
      actorId: requester.id,
      action: 'purge',
      entityType: 'User',
      entityId: targetUserId,
      before: { id: targetUserId, roleName: target.roleName, status: target.status },
      after: null,
    });

    return { id: targetUserId, deleted: true };
  }
}

export { HardDeleteUserUseCase };
