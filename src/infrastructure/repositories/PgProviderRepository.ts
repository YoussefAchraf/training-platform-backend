import { Provider } from '../../domain/entities/Provider';
import { IProviderRepository } from '../../domain/interfaces/IProviderRepository';

function mapRow(row) {
  if (!row) return null;
  return new Provider({
    id: row.id,
    name: row.name,
    description: row.description,
    logoUrl: row.logo_url,
    createdBy: row.created_by,
    creatorName: row.users ? `${row.users.firstname} ${row.users.lastname}` : null,
    createdAt: row.created_at,
  });
}

const CREATOR_INCLUDE = { users: { select: { firstname: true, lastname: true } } };

class PgProviderRepository extends IProviderRepository {
  prisma: any;

  constructor(prisma) {
    super();
    this.prisma = prisma;
  }

  async create(provider) {
    const row = await this.prisma.providers.create({
      data: {
        name: provider.name,
        description: provider.description,
        logo_url: provider.logoUrl || null,
        created_by: provider.createdBy,
      },
      include: CREATOR_INCLUDE,
    });
    return mapRow(row);
  }

  async update(id, fields) {
    const data: any = { updated_at: new Date() };
    if (fields.name) data.name = fields.name;
    if (fields.description) data.description = fields.description;
    if (fields.logoUrl) data.logo_url = fields.logoUrl;

    
    
    
    
    
    const result = await this.prisma.providers.updateMany({ where: { id, deleted_at: null }, data });
    if (result.count === 0) return null;
    return this.findById(id);
  }

  async softDelete(id) {
    const result = await this.prisma.providers.updateMany({
      where: { id, deleted_at: null },
      data: { deleted_at: new Date() },
    });
    if (result.count === 0) return null;
    
    
    
    const row = await this.prisma.providers.findUnique({ where: { id }, include: CREATOR_INCLUDE });
    return mapRow(row);
  }

  async findById(id) {
    const row = await this.prisma.providers.findFirst({ where: { id, deleted_at: null }, include: CREATOR_INCLUDE });
    return mapRow(row);
  }

  async findByName(name) {
    
    
    
    const row = await this.prisma.providers.findFirst({ where: { name, deleted_at: null }, include: CREATOR_INCLUDE });
    return mapRow(row);
  }

  async listAll() {
    const rows = await this.prisma.providers.findMany({
      where: { deleted_at: null },
      include: CREATOR_INCLUDE,
      orderBy: { name: 'asc' },
    });
    return rows.map(mapRow);
  }
}

export { PgProviderRepository };
