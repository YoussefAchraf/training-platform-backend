class AnnouncementController {
  createFeatureAnnouncementUseCase: any;
  listFeatureAnnouncementsUseCase: any;
  listMyPendingAnnouncementsUseCase: any;
  rateFeatureAnnouncementUseCase: any;

  constructor({
    createFeatureAnnouncementUseCase,
    listFeatureAnnouncementsUseCase,
    listMyPendingAnnouncementsUseCase,
    rateFeatureAnnouncementUseCase,
  }) {
    this.createFeatureAnnouncementUseCase = createFeatureAnnouncementUseCase;
    this.listFeatureAnnouncementsUseCase = listFeatureAnnouncementsUseCase;
    this.listMyPendingAnnouncementsUseCase = listMyPendingAnnouncementsUseCase;
    this.rateFeatureAnnouncementUseCase = rateFeatureAnnouncementUseCase;
  }

  create = async (req, res) => {
    try {
      const { title, description, targetRoles } = req.body;
      const announcement = await this.createFeatureAnnouncementUseCase.execute({
        requester: req.user,
        title,
        description,
        targetRoles,
      });
      res.status(201).json(announcement);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  };

  list = async (req, res) => {
    try {
      const announcements = await this.listFeatureAnnouncementsUseCase.execute({ requester: req.user });
      res.status(200).json(announcements);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  };

  listMine = async (req, res) => {
    try {
      const announcements = await this.listMyPendingAnnouncementsUseCase.execute({ requester: req.user });
      res.status(200).json(announcements);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  };

  rate = async (req, res) => {
    try {
      const { stars } = req.body;
      const result = await this.rateFeatureAnnouncementUseCase.execute({
        requester: req.user,
        announcementId: Number(req.params.id),
        stars,
      });
      res.status(200).json(result);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  };
}

export { AnnouncementController };
