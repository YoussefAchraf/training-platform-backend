import { Client } from '../../domain/entities/Client';
import { IClientRepository } from '../../domain/interfaces/IClientRepository';

function mapRow(row) {
  if (!row) return null;
  return new Client({
    id: row.id,
    companyName: row.company_name,
    email: row.email,
    phone: row.phone,
    createdBy: row.created_by,
    creatorName: row.users ? `${row.users.firstname} ${row.users.lastname}` : null,
    createdAt: row.created_at,
  });
}

const CREATOR_INCLUDE = { users: { select: { firstname: true, lastname: true } } };

class PgClientRepository extends IClientRepository {
  prisma: any;

  constructor(prisma) {
    super();
    this.prisma = prisma;
  }

  async create(client) {
    const row = await this.prisma.clients.create({
      data: {
        company_name: client.companyName,
        email: client.email,
        phone: client.phone,
        created_by: client.createdBy,
      },
      include: CREATOR_INCLUDE,
    });
    return mapRow(row);
  }

  async findById(id) {
    const row = await this.prisma.clients.findFirst({ where: { id, deleted_at: null }, include: CREATOR_INCLUDE });
    return mapRow(row);
  }

  async listAll() {
    const rows = await this.prisma.clients.findMany({
      where: { deleted_at: null },
      include: CREATOR_INCLUDE,
      orderBy: { created_at: 'desc' },
    });
    return rows.map(mapRow);
  }

  async update(id, fields) {
    const data: any = { updated_at: new Date() };
    if (fields.companyName) data.company_name = fields.companyName;
    if (fields.email) data.email = fields.email;
    if (fields.phone) data.phone = fields.phone;

    const result = await this.prisma.clients.updateMany({ where: { id, deleted_at: null }, data });
    if (result.count === 0) return null;
    return this.findById(id);
  }

  async softDelete(id) {
    const result = await this.prisma.clients.updateMany({
      where: { id, deleted_at: null },
      data: { deleted_at: new Date() },
    });
    if (result.count === 0) return null;
    const row = await this.prisma.clients.findUnique({ where: { id }, include: CREATOR_INCLUDE });
    return mapRow(row);
  }
}

export { PgClientRepository };
