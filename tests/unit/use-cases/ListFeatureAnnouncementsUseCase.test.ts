import { ListFeatureAnnouncementsUseCase } from '../../../src/use-cases/announcements/ListFeatureAnnouncementsUseCase';

function buildRequester(overrides: Record<string, any> = {}) {
  return {
    isDeveloper: () => false,
    ...overrides,
  };
}

describe('ListFeatureAnnouncementsUseCase', () => {
  it('rejects a requester who is not Developer', async () => {
    const announcementRepository = { listAllWithRatings: jest.fn() };
    const useCase = new ListFeatureAnnouncementsUseCase({ announcementRepository });

    await expect(useCase.execute({ requester: buildRequester() })).rejects.toThrow(
      'Only Developer can view feature announcement ratings'
    );
    expect(announcementRepository.listAllWithRatings).not.toHaveBeenCalled();
  });

  it('returns every announcement with ratings for a Developer', async () => {
    const announcements = [{ id: 1, title: 'X', overallAverageStars: 4.5, byRole: [] }];
    const announcementRepository = { listAllWithRatings: jest.fn().mockResolvedValue(announcements) };
    const useCase = new ListFeatureAnnouncementsUseCase({ announcementRepository });

    const result = await useCase.execute({ requester: buildRequester({ isDeveloper: () => true }) });

    expect(result).toEqual(announcements);
  });
});
