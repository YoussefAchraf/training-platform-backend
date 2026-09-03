class FeatureAnnouncement {
  id: any;
  createdBy: any;
  title: any;
  description: any;
  targetRoles: any;
  createdAt: any;

  constructor({ id, createdBy, title, description, targetRoles, createdAt }: any) {
    this.id = id;
    this.createdBy = createdBy;
    this.title = title;
    this.description = description;
    this.targetRoles = targetRoles;
    this.createdAt = createdAt;
  }
}

export { FeatureAnnouncement };
