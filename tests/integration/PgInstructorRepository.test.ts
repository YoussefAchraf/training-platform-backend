


import { PgInstructorRepository } from '../../src/infrastructure/repositories/PgInstructorRepository';
import { prismaClient } from '../../src/infrastructure/database/prismaClient';

describe('PgInstructorRepository (Prisma, real database)', () => {
  const repository = new PgInstructorRepository(prismaClient);
  const marker = `instructor-test-${Date.now()}`;
  let userId: number;
  let instructorId: number;
  let trainingIdA: number;
  let trainingIdB: number;

  beforeAll(async () => {
    const role = await prismaClient.roles.findFirstOrThrow();
    const provider = await prismaClient.providers.create({ data: { name: marker } });
    const trainingA = await prismaClient.trainings.create({ data: { name: `${marker}-A`, provider_id: provider.id } });
    const trainingB = await prismaClient.trainings.create({ data: { name: `${marker}-B`, provider_id: provider.id } });
    trainingIdA = trainingA.id;
    trainingIdB = trainingB.id;

    const user = await prismaClient.users.create({
      data: {
        firstname: 'Instructor',
        lastname: 'Tester',
        email: `${marker}@example.com`,
        password_hash: 'x',
        role_id: role.id,
        status: 'approved',
      },
    });
    userId = user.id;
  });

  afterAll(async () => {
    await prismaClient.instructor_skills.deleteMany({ where: { instructor_id: instructorId } });
    await prismaClient.instructors.deleteMany({ where: { user_id: userId } });
    await prismaClient.users.delete({ where: { id: userId } });
    await prismaClient.trainings.deleteMany({ where: { id: { in: [trainingIdA, trainingIdB] } } });
    await prismaClient.providers.deleteMany({ where: { name: marker } });
    await prismaClient.$disconnect();
  });

  it('creates an instructor with the joined user fields populated', async () => {
    const instructor = await repository.create({ userId, bio: 'test bio' });
    instructorId = instructor.id;

    expect(instructor.firstname).toBe('Instructor');
    expect(instructor.email).toBe(`${marker}@example.com`);
    expect(instructor.skills).toEqual([]);
  });

  it('setSkills replaces the full set atomically, including going back to zero', async () => {
    const withOne = await repository.setSkills(instructorId, [trainingIdA]);
    expect(withOne.map((s) => s.trainingId)).toEqual([trainingIdA]);

    const withBoth = await repository.setSkills(instructorId, [trainingIdA, trainingIdB]);
    expect(withBoth.map((s) => s.trainingId).sort()).toEqual([trainingIdA, trainingIdB].sort());

    const withNone = await repository.setSkills(instructorId, []);
    expect(withNone).toEqual([]);

    const isQualified = await repository.isQualifiedForTraining(instructorId, trainingIdA);
    expect(isQualified).toBe(false);
  });

  it('listAll excludes non-approved instructors unless includeAllStatuses is set', async () => {
    await prismaClient.users.update({ where: { id: userId }, data: { status: 'pending' } });

    const approvedOnly = await repository.listAll();
    expect(approvedOnly.find((i) => i.id === instructorId)).toBeUndefined();

    const everyone = await repository.listAll({ includeAllStatuses: true });
    expect(everyone.find((i) => i.id === instructorId)).toBeDefined();

    await prismaClient.users.update({ where: { id: userId }, data: { status: 'approved' } });
  });
});
