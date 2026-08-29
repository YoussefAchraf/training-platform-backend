import { ROLES } from '../../domain/entities/User';

const FILTERABLE_ROLES = Object.values(ROLES);

class GetAuditLogUseCase {
  auditLogRepository: any;

  constructor({ auditLogRepository }) {
    this.auditLogRepository = auditLogRepository;
  }

  async execute({
    requester,
    entityType,
    entityId,
    startDate,
    endDate,
    roleName,
  }: {
    requester: any;
    entityType?: any;
    entityId?: any;
    startDate?: any;
    endDate?: any;
    roleName?: any;
  }) {
    if (!requester.isManager() && !requester.isSuperAdmin()) {
      throw new Error('Only a Manager or SuperAdmin can view the audit log');
    }

    if (roleName && !FILTERABLE_ROLES.includes(roleName)) {
      throw new Error(`roleName must be one of: ${FILTERABLE_ROLES.join(', ')}`);
    }

    if (requester.isSuperAdmin()) {
      return this.auditLogRepository.list({ entityType, entityId, startDate, endDate, roleName });
    }

    if (entityType === 'User') {
      throw new Error('Managers cannot view audit log entries for User changes');
    }

    return this.auditLogRepository.list({
      entityType,
      entityId,
      startDate,
      endDate,
      roleName,
      excludeEntityTypes: ['User'],
    });
  }
}

export { GetAuditLogUseCase };
