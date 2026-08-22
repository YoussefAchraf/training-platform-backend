




import { PgProviderRepository } from '../../src/infrastructure/repositories/PgProviderRepository';
import { PgTrainingRepository } from '../../src/infrastructure/repositories/PgTrainingRepository';
import { PgClientRepository } from '../../src/infrastructure/repositories/PgClientRepository';
import { prismaClient } from '../../src/infrastructure/database/prismaClient';

describe('Catalog repositories (Prisma, real database)', () => {
  const providerRepo = new PgProviderRepository(prismaClient);
  const trainingRepo = new PgTrainingRepository(prismaClient);
  const clientRepo = new PgClientRepository(prismaClient);
  const marker = `catalog-test-${Date.now()}`;
  let userId: number;
  let providerId: number;
  let trainingId: number;
  let clientId: number;

  beforeAll(async () => {
    const role = await prismaClient.roles.findFirstOrThrow();
    const user = await prismaClient.users.create({
      data: { firstname: 'Catalog', lastname: 'Tester', email: `${marker}@example.com`, password_hash: 'x', role_id: role.id },
    });
    userId = user.id;
  });

  afterAll(async () => {
    await prismaClient.trainings.deleteMany({ where: { name: { startsWith: marker } } });
    await prismaClient.clients.deleteMany({ where: { company_name: { startsWith: marker } } });
    await prismaClient.providers.deleteMany({ where: { name: { startsWith: marker } } });
    await prismaClient.users.delete({ where: { id: userId } });
    await prismaClient.$disconnect();
  });

  it('provider: create returns the joined creator name, softDelete then update returns null (not a throw)', async () => {
    const provider = await providerRepo.create({ name: marker, description: 'd', createdBy: userId });
    providerId = provider.id;
    expect(provider.creatorName).toBe('Catalog Tester');

    await providerRepo.softDelete(providerId);
    expect(await providerRepo.findById(providerId)).toBeNull();

    const updateAfterDelete = await providerRepo.update(providerId, { name: 'should not apply' });
    expect(updateAfterDelete).toBeNull();
  });

  it('training: duration 0 is a real settable value, not skipped like a falsy string would be', async () => {
    const provider = await providerRepo.create({ name: `${marker}-tp`, createdBy: userId });
    const training = await trainingRepo.create({
      name: `${marker}-training`,
      providerId: provider.id,
      description: 'd',
      duration: 5,
      createdBy: userId,
    });
    trainingId = training.id;
    expect(training.providerName).toBe(`${marker}-tp`);

    const updated = await trainingRepo.update(trainingId, { duration: 0 });
    expect(updated.duration).toBe(0);
  });

  it('client: softDelete return value has no providerName concept but still has creatorName', async () => {
    const client = await clientRepo.create({ companyName: `${marker}-client`, email: 'a@b.com', phone: '123', createdBy: userId });
    clientId = client.id;

    const deleted = await clientRepo.softDelete(clientId);
    expect(deleted.creatorName).toBe('Catalog Tester');
    expect(await clientRepo.findById(clientId)).toBeNull();
  });
});
