class Training {
  id: any;
  name: any;
  providerId: any;
  providerName: any;
  description: any;
  duration: any;
  durationUnit: any;
  createdBy: any;
  creatorName: any;
  createdAt: any;

  constructor({ id, name, providerId, providerName, description, duration, durationUnit, createdBy, creatorName, createdAt }: any) {
    this.id = id;
    this.name = name;
    this.providerId = providerId;
    this.providerName = providerName;
    this.description = description;
    this.duration = duration;
    this.durationUnit = durationUnit;
    this.createdBy = createdBy;
    this.creatorName = creatorName;
    this.createdAt = createdAt;
  }
}

export { Training };
