class GetAuditLogUseCase {
  auditLogRepository: any;

  constructor({ auditLogRepository }) {
    this.auditLogRepository = auditLogRepository;
  }

  async execute({ requester, entityType, entityId }) {
    if (!requester.isManager() && !requester.isSuperAdmin()) {
      throw new Error('Only a Manager or SuperAdmin can view the audit log');
    }

    if (requester.isSuperAdmin()) {
      return this.auditLogRepository.list({ entityType, entityId });
    }

    if (entityType === 'User') {
      throw new Error('Managers cannot view audit log entries for User changes');
    }

    return this.auditLogRepository.list({ entityType, entityId, excludeEntityTypes: ['User'] });
  }
}

export { GetAuditLogUseCase };
