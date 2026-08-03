class AdminController {
  getAdminSessionsOverviewUseCase: any;
  getAuditLogUseCase: any;

  constructor({ getAdminSessionsOverviewUseCase, getAuditLogUseCase }) {
    this.getAdminSessionsOverviewUseCase = getAdminSessionsOverviewUseCase;
    this.getAuditLogUseCase = getAuditLogUseCase;
  }

  sessionsOverview = async (req, res) => {
    try {
      const sessions = await this.getAdminSessionsOverviewUseCase.execute({ requester: req.user });
      res.status(200).json(sessions);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  };

  auditLog = async (req, res) => {
    try {
      const entityType = req.query.entityType ? String(req.query.entityType) : undefined;
      const entityId = req.query.entityId ? Number(req.query.entityId) : undefined;
      const entries = await this.getAuditLogUseCase.execute({ requester: req.user, entityType, entityId });
      res.status(200).json(entries);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  };
}

export { AdminController };
