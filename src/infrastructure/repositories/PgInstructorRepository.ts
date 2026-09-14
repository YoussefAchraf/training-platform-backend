import { Instructor } from '../../domain/entities/Instructor';
import { IInstructorRepository } from '../../domain/interfaces/IInstructorRepository';

function mapRow(row) {
  if (!row) return null;
  return new Instructor({
    id: row.id,
    userId: row.user_id,
    bio: row.bio,
    firstname: row.users.firstname,
    lastname: row.users.lastname,
    email: row.users.email,
    status: row.users.status,
  });
}

const USER_FIELDS_INCLUDE = { users: { select: { firstname: true, lastname: true, email: true, status: true } } };

class PgInstructorRepository extends IInstructorRepository {
  prisma: any;

  constructor(prisma) {
    super();
    this.prisma = prisma;
  }

  async create(instructor) {
    const created = await this.prisma.instructors.create({
      data: { user_id: instructor.userId, bio: instructor.bio || null },
    });
    return this.findById(created.id);
  }

  async findById(id) {
    const row = await this.prisma.instructors.findUnique({ where: { id }, include: USER_FIELDS_INCLUDE });
    const instructor = mapRow(row);
    if (instructor) instructor.skills = await this.getSkills(id);
    return instructor;
  }

  async findByUserId(userId) {
    const row = await this.prisma.instructors.findUnique({ where: { user_id: userId }, include: USER_FIELDS_INCLUDE });
    const instructor = mapRow(row);
    if (instructor) instructor.skills = await this.getSkills(instructor.id);
    return instructor;
  }

  async listAll({ includeAllStatuses = false }: { includeAllStatuses?: boolean } = {}) {
    const rows = await this.prisma.instructors.findMany({
      where: includeAllStatuses ? undefined : { users: { status: 'approved' } },
      include: USER_FIELDS_INCLUDE,
      orderBy: { users: { lastname: 'asc' } },
    });
    const instructors = rows.map(mapRow);
    for (const instructor of instructors) {
      instructor.skills = await this.getSkills(instructor.id);
    }
    return instructors;
  }

  async isQualifiedForTraining(instructorId, trainingId) {
    
    
    
    const match = await this.prisma.instructor_skills.findFirst({
      where: {
        instructor_id: instructorId,
        training_id: trainingId,
        OR: [{ certificate_expires_at: null }, { certificate_expires_at: { gt: new Date() } }],
      },
    });
    return match !== null;
  }

  async updateBio(instructorId, bio) {
    await this.prisma.instructors.update({
      where: { id: instructorId },
      data: { bio, updated_at: new Date() },
    });
    return this.findById(instructorId);
  }

  async setSkills(instructorId, skills) {
    
    
    
    
    await this.prisma.$transaction([
      this.prisma.instructor_skills.deleteMany({ where: { instructor_id: instructorId } }),
      this.prisma.instructor_skills.createMany({
        data: skills.map((skill) => ({
          instructor_id: instructorId,
          training_id: skill.trainingId,
          certificate_id: skill.certificateId || null,
          certificate_expires_at: skill.certificateExpiresAt ? new Date(skill.certificateExpiresAt) : null,
        })),
      }),
    ]);
    return this.getSkills(instructorId);
  }

  async getSkills(instructorId) {
    const rows = await this.prisma.instructor_skills.findMany({
      where: { instructor_id: instructorId },
      include: { trainings: { select: { id: true, name: true } } },
    });
    return rows.map((r) => ({
      trainingId: r.trainings.id,
      trainingName: r.trainings.name,
      certificateId: r.certificate_id,
      certificateExpiresAt: r.certificate_expires_at,
    }));
  }

  async listExpiringCertifications(withinDays) {
    const rows = await this.prisma.instructor_skills.findMany({
      where: {
        expiry_reminder_sent_at: null,
        certificate_expires_at: { not: null, lte: new Date(Date.now() + withinDays * 24 * 60 * 60 * 1000) },
      },
      include: {
        trainings: { select: { id: true, name: true } },
        instructors: { select: { id: true, user_id: true, users: { select: { firstname: true } } } },
      },
      orderBy: { certificate_expires_at: 'asc' },
    });
    return rows.map((r) => ({
      instructorId: r.instructors.id,
      instructorUserId: r.instructors.user_id,
      instructorFirstname: r.instructors.users.firstname,
      trainingId: r.trainings.id,
      trainingName: r.trainings.name,
      certificateExpiresAt: r.certificate_expires_at,
    }));
  }

  async markExpiryReminderSent(instructorId, trainingId) {
    await this.prisma.instructor_skills.update({
      where: { instructor_id_training_id: { instructor_id: instructorId, training_id: trainingId } },
      data: { expiry_reminder_sent_at: new Date() },
    });
  }
}

export { PgInstructorRepository };
