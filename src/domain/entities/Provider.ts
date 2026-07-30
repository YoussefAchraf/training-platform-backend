class Provider {
  id: any;
  name: any;
  description: any;
  createdAt: any;

  constructor({ id, name, description, createdAt }: any) {
    this.id = id;
    this.name = name;
    this.description = description;
    this.createdAt = createdAt;
  }
}

export { Provider };
