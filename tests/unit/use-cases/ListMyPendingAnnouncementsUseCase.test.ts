import { ListMyPendingAnnouncementsUseCase } from '../../../src/use-cases/announcements/ListMyPendingAnnouncementsUseCase';

function buildRequester(overrides: Record<string, any> = {}) {
  return {
    id: 1,
    roleName: 'Sales',
    createdAt: new Date('2026-01-01T00:00:00Z'),
    isDeveloper: () => false,
    ...overrides,
  };
}

describe('ListMyPendingAnnouncementsUseCase', () => {
  it('returns an empty array for a Developer without touching the repository', async () => {
    const announcementRepository = { listPendingForUser: jest.fn() };
    const useCase = new ListMyPendingAnnouncementsUseCase({ announcementRepository });

    const result = await useCase.execute({ requester: buildRequester({ isDeveloper: () => true }) });

    expect(result).toEqual([]);
    expect(announcementRepository.listPendingForUser).not.toHaveBeenCalled();
  });

  it('asks the repository for pending announcements scoped to the requester role and join date', async () => {
    const pending = [{ id: 1, title: 'New feature' }];
    const announcementRepository = { listPendingForUser: jest.fn().mockResolvedValue(pending) };
    const useCase = new ListMyPendingAnnouncementsUseCase({ announcementRepository });
    const joinedAt = new Date('2026-02-15T00:00:00Z');

    const result = await useCase.execute({
      requester: buildRequester({ id: 5, roleName: 'Instructor', createdAt: joinedAt }),
    });

    expect(announcementRepository.listPendingForUser).toHaveBeenCalledWith({
      userId: 5,
      role: 'Instructor',
      joinedAt,
    });
    expect(result).toEqual(pending);
  });
});
