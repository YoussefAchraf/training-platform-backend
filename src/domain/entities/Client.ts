class Client {
  id: any;
  companyName: any;
  email: any;
  phone: any;
  createdBy: any;
  createdAt: any;

  constructor({ id, companyName, email, phone, createdBy, createdAt }: any) {
    this.id = id;
    this.companyName = companyName;
    this.email = email;
    this.phone = phone;
    this.createdBy = createdBy;
    this.createdAt = createdAt;
  }
}

export { Client };
