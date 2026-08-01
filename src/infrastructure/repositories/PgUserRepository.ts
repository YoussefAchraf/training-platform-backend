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
    roleName: row.role_name,
    status: row.status,
    approvedBy: row.approved_by,
    approvedAt: row.approved_at,
    createdAt: row.created_at,
  });
}

const SELECT_BASE = `
  SELECT u.*, r.name AS role_name
  FROM users u
  JOIN roles r ON r.id = u.role_id
`;

class PgUserRepository extends IUserRepository {
  pool: any;

  constructor(pool) {
    super();
    this.pool = pool;
  }

  async findById(id) {
    const { rows } = await this.pool.query(`${SELECT_BASE} WHERE u.id = $1`, [id]);
    return mapRow(rows[0]);
  }

  async findByEmail(email) {
    const { rows } = await this.pool.query(`${SELECT_BASE} WHERE u.email = $1`, [email]);
    return mapRow(rows[0]);
  }

  async findRoleByName(roleName) {
    const { rows } = await this.pool.query('SELECT * FROM roles WHERE name = $1', [roleName]);
    return rows[0] || null;
  }

  async create(user) {
    const { rows } = await this.pool.query(
      `INSERT INTO users (firstname, lastname, email, password_hash, role_id, status)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [user.firstname, user.lastname, user.email, user.passwordHash, user.roleId, user.status]
    );
    return this.findById(rows[0].id);
  }

  async approve(userId, approvedByUserId) {
    await this.pool.query(
      `UPDATE users
       SET status = 'approved', approved_by = $2, approved_at = now(), updated_at = now()
       WHERE id = $1`,
      [userId, approvedByUserId]
    );
    return this.findById(userId);
  }

  async reject(userId, approvedByUserId) {
    await this.pool.query(
      `UPDATE users
       SET status = 'rejected', approved_by = $2, approved_at = now(), updated_at = now()
       WHERE id = $1`,
      [userId, approvedByUserId]
    );
    return this.findById(userId);
  }

  async listPending() {
    const { rows } = await this.pool.query(`${SELECT_BASE} WHERE u.status = 'pending' ORDER BY u.created_at ASC`);
    return rows.map(mapRow);
  }


  async listApprovedManagers() {
    const { rows } = await this.pool.query(
      `${SELECT_BASE} WHERE r.name = 'Manager' AND u.status = 'approved'`
    );
    return rows.map(mapRow);
  }

  async listAll() {
    const { rows } = await this.pool.query(`${SELECT_BASE} ORDER BY u.created_at DESC`);
    return rows.map(mapRow);
  }

  async update(userId, fields) {
    const { rows } = await this.pool.query(
      `UPDATE users
       SET firstname = COALESCE($2, firstname),
           lastname = COALESCE($3, lastname),
           email = COALESCE($4, email),
           role_id = COALESCE($5, role_id),
           status = COALESCE($6, status),
           updated_at = now()
       WHERE id = $1
       RETURNING id`,
      [
        userId,
        fields.firstname || null,
        fields.lastname || null,
        fields.email || null,
        fields.roleId || null,
        fields.status || null,
      ]
    );
    return this.findById(rows[0].id);
  }

  async countActiveSuperAdmins() {
    const { rows } = await this.pool.query(
      `SELECT COUNT(*)::int AS count FROM users u JOIN roles r ON r.id = u.role_id
       WHERE r.name = 'SuperAdmin' AND u.status = 'approved'`
    );
    return rows[0].count;
  }
}

export { PgUserRepository };
