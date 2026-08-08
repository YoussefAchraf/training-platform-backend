class Client {
  id: any;
  companyName: any;
  email: any;
  phone: any;
  createdBy: any;
  creatorName: any;
  createdAt: any;

  constructor({ id, companyName, email, phone, createdBy, creatorName, createdAt }: any) {
    this.id = id;
    this.companyName = companyName;
    this.email = email;
    this.phone = phone;
    this.createdBy = createdBy;
    this.creatorName = creatorName;
    this.createdAt = createdAt;
  }
}

export { Client };
