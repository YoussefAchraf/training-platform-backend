import { IRoleRepository } from '../../domain/interfaces/IRoleRepository';

class PgRoleRepository extends IRoleRepository {
  prisma: any;

  constructor(prisma) {
    super();
    this.prisma = prisma;
  }

  async listAll() {
    return this.prisma.roles.findMany({
      select: { id: true, name: true },
      orderBy: { id: 'asc' },
    });
  }
}

export { PgRoleRepository };
