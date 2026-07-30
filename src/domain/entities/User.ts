const ROLES = Object.freeze({
  SALES: 'Sales',
  MANAGER: 'Manager',
  INSTRUCTOR: 'Instructor',
});

const USER_STATUS = Object.freeze({
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
});

class User {
  id: any;
  firstname: any;
  lastname: any;
  email: any;
  passwordHash: any;
  roleId: any;
  roleName: any;
  status: any;
  approvedBy: any;
  approvedAt: any;
  createdAt: any;

  constructor({
    id,
    firstname,
    lastname,
    email,
    passwordHash,
    roleId,
    roleName,
    status = USER_STATUS.PENDING,
    approvedBy = null,
    approvedAt = null,
    createdAt,
  }: any) {
    this.id = id;
    this.firstname = firstname;
    this.lastname = lastname;
    this.email = email;
    this.passwordHash = passwordHash;
    this.roleId = roleId;
    this.roleName = roleName;
    this.status = status;
    this.approvedBy = approvedBy;
    this.approvedAt = approvedAt;
    this.createdAt = createdAt;
  }

  isApproved() {
    return this.status === USER_STATUS.APPROVED;
  }

  isManager() {
    return this.roleName === ROLES.MANAGER;
  }

  isSales() {
    return this.roleName === ROLES.SALES;
  }

  isInstructor() {
    return this.roleName === ROLES.INSTRUCTOR;
  }

  
  canManageCatalog() {
    return this.isSales() || this.isManager();
  }

  toSafeJSON() {
    return {
      id: this.id,
      firstname: this.firstname,
      lastname: this.lastname,
      email: this.email,
      role: this.roleName,
      status: this.status,
    };
  }
}

export { User, ROLES, USER_STATUS };
