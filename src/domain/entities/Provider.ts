class Provider {
  id: any;
  name: any;
  description: any;
  logoUrl: any;
  createdBy: any;
  creatorName: any;
  createdAt: any;

  constructor({ id, name, description, logoUrl, createdBy, creatorName, createdAt }: any) {
    this.id = id;
    this.name = name;
    this.description = description;
    this.logoUrl = logoUrl;
    this.createdBy = createdBy;
    this.creatorName = creatorName;
    this.createdAt = createdAt;
  }
}

export { Provider };
