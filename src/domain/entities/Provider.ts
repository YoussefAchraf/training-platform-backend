class Provider {
  id: any;
  name: any;
  description: any;
  createdBy: any;
  createdAt: any;

  constructor({ id, name, description, createdBy, createdAt }: any) {
    this.id = id;
    this.name = name;
    this.description = description;
    this.createdBy = createdBy;
    this.createdAt = createdAt;
  }
}

export { Provider };
