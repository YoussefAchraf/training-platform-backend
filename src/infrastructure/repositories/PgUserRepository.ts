import { User } from '../../domain/entities/User';
import { IUserRepository } from '../../domain/interfaces/IUserRepository';

function mapRow(row) {
  if (!row) return null;
  return new User({
    id: row.id,
    firstname: row.firstname,
    lastname: row.lastname,
    email: row.email,
    passwordHash: row.password_hash,
    roleId: row.role_id,
    roleName: row.roles.name,
    status: row.status,
    approvedBy: row.approved_by,
    approvedAt: row.approved_at,
    hasSeenTour: row.has_seen_tour,
    createdAt: row.created_at,
  });
}

const ROLE_INCLUDE = { roles: { select: { name: true } } };

class PgUserRepository extends IUserRepository {
  prisma: any;

  constructor(prisma) {
    super();
    this.prisma = prisma;
  }

  async findById(id) {
    const row = await this.prisma.users.findUnique({ where: { id }, include: ROLE_INCLUDE });
    return mapRow(row);
  }

  async findByEmail(email) {
    const row = await this.prisma.users.findUnique({ where: { email }, include: ROLE_INCLUDE });
    return mapRow(row);
  }

  async findRoleByName(roleName) {
    return this.prisma.roles.findUnique({ where: { name: roleName } });
  }

  async create(user) {
    const created = await this.prisma.users.create({
      data: {
        firstname: user.firstname,
        lastname: user.lastname,
        email: user.email,
        password_hash: user.passwordHash,
        role_id: user.roleId,
        status: user.status,
      },
    });
    return this.findById(created.id);
  }

  async approve(userId, approvedByUserId) {
    
    
    
    
    
    await this.prisma.users.updateMany({
      where: { id: userId },
      data: { status: 'approved', approved_by: approvedByUserId, approved_at: new Date(), updated_at: new Date() },
    });
    return this.findById(userId);
  }

  async reject(userId, approvedByUserId) {
    await this.prisma.users.updateMany({
      where: { id: userId },
      data: { status: 'rejected', approved_by: approvedByUserId, approved_at: new Date(), updated_at: new Date() },
    });
    return this.findById(userId);
  }

  async listPending() {
    const rows = await this.prisma.users.findMany({
      where: { status: 'pending' },
      include: ROLE_INCLUDE,
      orderBy: { created_at: 'asc' },
    });
    return rows.map(mapRow);
  }

  async listApprovedManagers() {
    const rows = await this.prisma.users.findMany({
      where: { status: 'approved', roles: { name: 'Manager' } },
      include: ROLE_INCLUDE,
    });
    return rows.map(mapRow);
  }

  async listAll() {
    const rows = await this.prisma.users.findMany({ include: ROLE_INCLUDE, orderBy: { created_at: 'desc' } });
    return rows.map(mapRow);
  }

  async update(userId, fields) {
    const data: any = { updated_at: new Date() };
    if (fields.firstname) data.firstname = fields.firstname;
    if (fields.lastname) data.lastname = fields.lastname;
    if (fields.email) data.email = fields.email;
    if (fields.roleId) data.role_id = fields.roleId;
    if (fields.status) data.status = fields.status;
    if (fields.hasSeenTour !== undefined) data.has_seen_tour = fields.hasSeenTour;
    if (fields.passwordHash) data.password_hash = fields.passwordHash;

    
    
    
    
    
    
    
    
    
    const result = await this.prisma.users.updateMany({ where: { id: userId }, data });
    if (result.count === 0) return null;
    return this.findById(userId);
  }

  async countActiveSuperAdmins() {
    return this.prisma.users.count({ where: { status: 'approved', roles: { name: 'SuperAdmin' } } });
  }
}

export { PgUserRepository };
