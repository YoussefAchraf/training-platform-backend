import { Training } from '../../domain/entities/Training';
import { ITrainingRepository } from '../../domain/interfaces/ITrainingRepository';

function mapRow(row) {
  if (!row) return null;
  return new Training({
    id: row.id,
    name: row.name,
    providerId: row.provider_id,
    providerName: row.providers ? row.providers.name : undefined,
    description: row.description,
    duration: row.duration,
    createdBy: row.created_by,
    creatorName: row.users ? `${row.users.firstname} ${row.users.lastname}` : undefined,
    createdAt: row.created_at,
  });
}

const FULL_INCLUDE = {
  providers: { select: { name: true } },
  users: { select: { firstname: true, lastname: true } },
};

class PgTrainingRepository extends ITrainingRepository {
  prisma: any;

  constructor(prisma) {
    super();
    this.prisma = prisma;
  }

  async create(training) {
    const created = await this.prisma.trainings.create({
      data: {
        name: training.name,
        provider_id: training.providerId,
        description: training.description,
        duration: training.duration,
        created_by: training.createdBy,
      },
    });
    return this.findById(created.id);
  }

  async findById(id) {
    const row = await this.prisma.trainings.findFirst({ where: { id, deleted_at: null }, include: FULL_INCLUDE });
    return mapRow(row);
  }

  async listAll() {
    const rows = await this.prisma.trainings.findMany({
      where: { deleted_at: null },
      include: FULL_INCLUDE,
      orderBy: { created_at: 'desc' },
    });
    return rows.map(mapRow);
  }

  async listByProvider(providerId) {
    const rows = await this.prisma.trainings.findMany({
      where: { deleted_at: null, provider_id: providerId },
      include: FULL_INCLUDE,
    });
    return rows.map(mapRow);
  }

  async update(id, fields) {
    const data: any = { updated_at: new Date() };
    if (fields.name) data.name = fields.name;
    if (fields.description) data.description = fields.description;
    
    
    
    if (fields.duration !== undefined && fields.duration !== null) data.duration = fields.duration;

    await this.prisma.trainings.updateMany({ where: { id, deleted_at: null }, data });
    return this.findById(id);
  }

  async softDelete(id) {
    const result = await this.prisma.trainings.updateMany({
      where: { id, deleted_at: null },
      data: { deleted_at: new Date() },
    });
    if (result.count === 0) return null;
    
    
    
    
    const row = await this.prisma.trainings.findUnique({
      where: { id },
      include: { users: { select: { firstname: true, lastname: true } } },
    });
    return mapRow(row);
  }
}

export { PgTrainingRepository };
