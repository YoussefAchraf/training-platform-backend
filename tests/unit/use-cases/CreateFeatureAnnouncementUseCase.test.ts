import { CreateFeatureAnnouncementUseCase } from '../../../src/use-cases/announcements/CreateFeatureAnnouncementUseCase';

function buildRequester(overrides: Record<string, any> = {}) {
  return {
    id: 1,
    isDeveloper: () => true,
    ...overrides,
  };
}

describe('CreateFeatureAnnouncementUseCase', () => {
  it('rejects a requester who is not Developer', async () => {
    const announcementRepository = { create: jest.fn() };
    const useCase = new CreateFeatureAnnouncementUseCase({ announcementRepository });

    await expect(
      useCase.execute({
        requester: buildRequester({ isDeveloper: () => false }),
        title: 'New feature',
        description: 'Does a thing',
        targetRoles: ['Sales'],
      })
    ).rejects.toThrow('Only Developer can publish feature announcements');
    expect(announcementRepository.create).not.toHaveBeenCalled();
  });

  it('rejects a missing title', async () => {
    const announcementRepository = { create: jest.fn() };
    const useCase = new CreateFeatureAnnouncementUseCase({ announcementRepository });

    await expect(
      useCase.execute({ requester: buildRequester(), title: '  ', description: 'x', targetRoles: ['Sales'] })
    ).rejects.toThrow('title is required');
  });

  it('rejects a missing description', async () => {
    const announcementRepository = { create: jest.fn() };
    const useCase = new CreateFeatureAnnouncementUseCase({ announcementRepository });

    await expect(
      useCase.execute({ requester: buildRequester(), title: 'New feature', description: '', targetRoles: ['Sales'] })
    ).rejects.toThrow('description is required');
  });

  it('rejects an empty targetRoles array', async () => {
    const announcementRepository = { create: jest.fn() };
    const useCase = new CreateFeatureAnnouncementUseCase({ announcementRepository });

    await expect(
      useCase.execute({ requester: buildRequester(), title: 'New feature', description: 'x', targetRoles: [] })
    ).rejects.toThrow('targetRoles must be a non-empty array');
  });

  it('rejects targetRoles containing Developer or an unknown role', async () => {
    const announcementRepository = { create: jest.fn() };
    const useCase = new CreateFeatureAnnouncementUseCase({ announcementRepository });

    await expect(
      useCase.execute({
        requester: buildRequester(),
        title: 'New feature',
        description: 'x',
        targetRoles: ['Developer'],
      })
    ).rejects.toThrow('targetRoles must only contain');

    await expect(
      useCase.execute({
        requester: buildRequester(),
        title: 'New feature',
        description: 'x',
        targetRoles: ['NotARole'],
      })
    ).rejects.toThrow('targetRoles must only contain');
  });

  it('trims fields, dedupes targetRoles, and creates the announcement', async () => {
    const created = { id: 1, title: 'New feature' };
    const announcementRepository = { create: jest.fn().mockResolvedValue(created) };
    const useCase = new CreateFeatureAnnouncementUseCase({ announcementRepository });

    const result = await useCase.execute({
      requester: buildRequester({ id: 9 }),
      title: '  New feature  ',
      description: '  Does a thing  ',
      targetRoles: ['Sales', 'Manager', 'Sales'],
    });

    expect(announcementRepository.create).toHaveBeenCalledWith({
      createdBy: 9,
      title: 'New feature',
      description: 'Does a thing',
      targetRoles: ['Sales', 'Manager'],
    });
    expect(result).toEqual(created);
  });
});
