import { ROLES, USER_STATUS } from '../../domain/entities/User';

class UpdateUserByAdminUseCase {
  userRepository: any;
  auditLogRepository: any;

  constructor({ userRepository, auditLogRepository }) {
    this.userRepository = userRepository;
    this.auditLogRepository = auditLogRepository;
  }

  async execute({ requester, targetUserId, firstname, lastname, email, role, status }) {
    if (!requester.isSuperAdmin()) {
      throw new Error("Only a SuperAdmin can edit another user's profile");
    }

    const target = await this.userRepository.findById(targetUserId);
    if (!target) {
      throw new Error('User not found');
    }

    let roleId;
    if (role !== undefined) {
      if (!Object.values(ROLES).includes(role)) {
        throw new Error(`role must be one of: ${Object.values(ROLES).join(', ')}`);
      }
      const roleRow = await this.userRepository.findRoleByName(role);
      roleId = roleRow.id;
    }

    if (status !== undefined && !Object.values(USER_STATUS).includes(status)) {
      throw new Error(`status must be one of: ${Object.values(USER_STATUS).join(', ')}`);
    }

    const losingSuperAdminStatus =
      target.isSuperAdmin() &&
      ((role !== undefined && role !== ROLES.SUPER_ADMIN) ||
        (status !== undefined && status !== USER_STATUS.APPROVED));

    if (losingSuperAdminStatus) {
      const activeCount = await this.userRepository.countActiveSuperAdmins();
      if (activeCount <= 1) {
        throw new Error('Cannot change the role or status of the last remaining SuperAdmin');
      }
    }

    const updated = await this.userRepository.update(targetUserId, { firstname, lastname, email, roleId, status });

    await this.auditLogRepository.create({
      actorId: requester.id,
      action: 'update',
      entityType: 'User',
      entityId: targetUserId,
      before: target.toSafeJSON(),
      after: updated.toSafeJSON(),
    });

    return updated.toSafeJSON();
  }
}

export { UpdateUserByAdminUseCase };
