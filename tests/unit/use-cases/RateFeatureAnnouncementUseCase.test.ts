import { RateFeatureAnnouncementUseCase } from '../../../src/use-cases/announcements/RateFeatureAnnouncementUseCase';

function buildRequester(overrides: Record<string, any> = {}) {
  return {
    id: 1,
    roleName: 'Sales',
    isDeveloper: () => false,
    ...overrides,
  };
}

describe('RateFeatureAnnouncementUseCase', () => {
  it('rejects a Developer requester', async () => {
    const announcementRepository = { findById: jest.fn(), rate: jest.fn() };
    const useCase = new RateFeatureAnnouncementUseCase({ announcementRepository });

    await expect(
      useCase.execute({ requester: buildRequester({ isDeveloper: () => true }), announcementId: 1, stars: 5 })
    ).rejects.toThrow('Developer accounts cannot rate feature announcements');
    expect(announcementRepository.findById).not.toHaveBeenCalled();
  });

  it.each([0, 6, 2.5, -1, NaN])('rejects an out-of-range or non-integer stars value (%p)', async (stars) => {
    const announcementRepository = { findById: jest.fn(), rate: jest.fn() };
    const useCase = new RateFeatureAnnouncementUseCase({ announcementRepository });

    await expect(useCase.execute({ requester: buildRequester(), announcementId: 1, stars })).rejects.toThrow(
      'stars must be an integer between 1 and 5'
    );
    expect(announcementRepository.findById).not.toHaveBeenCalled();
  });

  it('rejects when the announcement does not exist', async () => {
    const announcementRepository = { findById: jest.fn().mockResolvedValue(null), rate: jest.fn() };
    const useCase = new RateFeatureAnnouncementUseCase({ announcementRepository });

    await expect(useCase.execute({ requester: buildRequester(), announcementId: 999, stars: 4 })).rejects.toThrow(
      'Announcement not found'
    );
    expect(announcementRepository.rate).not.toHaveBeenCalled();
  });

  it('rejects when the announcement is not targeted at the requester role', async () => {
    const announcementRepository = {
      findById: jest.fn().mockResolvedValue({ id: 1, targetRoles: ['Manager'] }),
      rate: jest.fn(),
    };
    const useCase = new RateFeatureAnnouncementUseCase({ announcementRepository });

    await expect(
      useCase.execute({ requester: buildRequester({ roleName: 'Sales' }), announcementId: 1, stars: 4 })
    ).rejects.toThrow('This announcement was not targeted at your role');
    expect(announcementRepository.rate).not.toHaveBeenCalled();
  });

  it('records the rating and returns a confirmation message', async () => {
    const announcementRepository = {
      findById: jest.fn().mockResolvedValue({ id: 1, targetRoles: ['Sales'] }),
      rate: jest.fn().mockResolvedValue(undefined),
    };
    const useCase = new RateFeatureAnnouncementUseCase({ announcementRepository });

    const result = await useCase.execute({
      requester: buildRequester({ id: 3, roleName: 'Sales' }),
      announcementId: 1,
      stars: '5',
    });

    expect(announcementRepository.rate).toHaveBeenCalledWith({ announcementId: 1, userId: 3, stars: 5 });
    expect(result).toEqual({ message: 'Rating recorded.' });
  });
});
