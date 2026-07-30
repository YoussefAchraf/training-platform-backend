class Training {
  id: any;
  name: any;
  providerId: any;
  providerName: any;
  description: any;
  duration: any;
  createdBy: any;
  createdAt: any;

  constructor({ id, name, providerId, providerName, description, duration, createdBy, createdAt }: any) {
    this.id = id;
    this.name = name;
    this.providerId = providerId;
    this.providerName = providerName;
    this.description = description;
    this.duration = duration;
    this.createdBy = createdBy;
    this.createdAt = createdAt;
  }
}

export { Training };
