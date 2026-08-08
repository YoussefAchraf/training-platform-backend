import { IRoleRepository } from '../../domain/interfaces/IRoleRepository';

class PgRoleRepository extends IRoleRepository {
  pool: any;

  constructor(pool) {
    super();
    this.pool = pool;
  }

  
  
  
  
  async listAll() {
    const { rows } = await this.pool.query('SELECT id, name FROM roles ORDER BY id ASC');
    return rows.map((row) => ({ id: row.id, name: row.name }));
  }
}

export { PgRoleRepository };
