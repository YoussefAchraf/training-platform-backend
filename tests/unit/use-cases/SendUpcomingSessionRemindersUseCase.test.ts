import { SendUpcomingSessionRemindersUseCase } from '../../../src/use-cases/sessions/SendUpcomingSessionRemindersUseCase';

const upcomingSession = {
  id: 5,
  trainingId: 3,
  instructorId: 9,
  createdBy: 1,
  startDate: '2026-01-01T10:00:00.000Z',
};

function buildRepos() {
  return {
    sessionRepository: {
      listNeeding24hReminder: jest.fn().mockResolvedValue([upcomingSession]),
      listNeeding1hReminder: jest.fn().mockResolvedValue([upcomingSession]),
      markReminder24hSent: jest.fn().mockResolvedValue(undefined),
      markReminder1hSent: jest.fn().mockResolvedValue(undefined),
    },
    trainingRepository: {
      findById: jest.fn().mockResolvedValue({ id: 3, name: 'RHCSA' }),
    },
    instructorRepository: {
      findById: jest.fn().mockResolvedValue({ id: 9, userId: 42 }),
    },
    pushSubscriptionRepository: {
      listByUserId: jest.fn().mockResolvedValue([{ endpoint: 'https://push.example/abc', p256dh: 'k', auth: 'a' }]),
      deleteByEndpointForUser: jest.fn().mockResolvedValue(undefined),
    },
    webPushService: {
      send: jest.fn().mockResolvedValue(undefined),
    },
  };
}

describe('SendUpcomingSessionRemindersUseCase', () => {
  it('lists the 24h-window candidates and marks the session reminded, for the 24h window', async () => {
    const repos = buildRepos();
    const useCase = new SendUpcomingSessionRemindersUseCase(repos);

    const result = await useCase.execute({ window: '24h' });

    expect(repos.sessionRepository.listNeeding24hReminder).toHaveBeenCalled();
    expect(repos.sessionRepository.listNeeding1hReminder).not.toHaveBeenCalled();
    expect(repos.sessionRepository.markReminder24hSent).toHaveBeenCalledWith(5);
    expect(repos.sessionRepository.markReminder1hSent).not.toHaveBeenCalled();
    expect(result).toEqual({ remindedCount: 1 });
  });

  it('lists the 1h-window candidates and marks the session reminded, for the 1h window', async () => {
    const repos = buildRepos();
    const useCase = new SendUpcomingSessionRemindersUseCase(repos);

    await useCase.execute({ window: '1h' });

    expect(repos.sessionRepository.listNeeding1hReminder).toHaveBeenCalled();
    expect(repos.sessionRepository.markReminder1hSent).toHaveBeenCalledWith(5);
    expect(repos.sessionRepository.markReminder24hSent).not.toHaveBeenCalled();
  });

  it('notifies both the assigned instructor and the session creator', async () => {
    const repos = buildRepos();
    const useCase = new SendUpcomingSessionRemindersUseCase(repos);

    await useCase.execute({ window: '1h' });

    expect(repos.instructorRepository.findById).toHaveBeenCalledWith(9);
    expect(repos.pushSubscriptionRepository.listByUserId).toHaveBeenCalledWith(42);
    expect(repos.pushSubscriptionRepository.listByUserId).toHaveBeenCalledWith(1);
    expect(repos.webPushService.send).toHaveBeenCalledWith(
      expect.objectContaining({ endpoint: 'https://push.example/abc' }),
      expect.objectContaining({ title: expect.any(String), body: expect.stringContaining('RHCSA'), url: '/sessions/5' }),
    );
  });

  it('notifies only the creator when no instructor is assigned yet', async () => {
    const repos = buildRepos();
    repos.sessionRepository.listNeeding1hReminder.mockResolvedValue([{ ...upcomingSession, instructorId: null }]);
    const useCase = new SendUpcomingSessionRemindersUseCase(repos);

    await useCase.execute({ window: '1h' });

    expect(repos.instructorRepository.findById).not.toHaveBeenCalled();
    expect(repos.pushSubscriptionRepository.listByUserId).toHaveBeenCalledTimes(1);
    expect(repos.pushSubscriptionRepository.listByUserId).toHaveBeenCalledWith(1);
  });

  it('notifies a user only once when the instructor is also the creator', async () => {
    const repos = buildRepos();
    repos.instructorRepository.findById.mockResolvedValue({ id: 9, userId: 1 });
    const useCase = new SendUpcomingSessionRemindersUseCase(repos);

    await useCase.execute({ window: '1h' });

    expect(repos.pushSubscriptionRepository.listByUserId).toHaveBeenCalledTimes(1);
    expect(repos.pushSubscriptionRepository.listByUserId).toHaveBeenCalledWith(1);
  });

  it('cleans up an expired push subscription without throwing', async () => {
    const repos = buildRepos();
    repos.webPushService.send.mockRejectedValue(Object.assign(new Error('gone'), { expired: true }));
    const useCase = new SendUpcomingSessionRemindersUseCase(repos);

    await expect(useCase.execute({ window: '1h' })).resolves.toEqual({ remindedCount: 1 });
    expect(repos.pushSubscriptionRepository.deleteByEndpointForUser).toHaveBeenCalledWith(
      'https://push.example/abc',
      42,
    );
  });

  it('does not let one session failing block the rest, and still marks reminded sessions it could process', async () => {
    const repos = buildRepos();
    repos.sessionRepository.listNeeding1hReminder.mockResolvedValue([
      { ...upcomingSession, id: 5, instructorId: 9 },
      { ...upcomingSession, id: 6, instructorId: 10 },
    ]);
    repos.instructorRepository.findById.mockImplementation((instructorId: number) =>
      instructorId === 9 ? Promise.reject(new Error('db is down')) : Promise.resolve({ id: 10, userId: 43 }),
    );
    const useCase = new SendUpcomingSessionRemindersUseCase(repos);

    const result = await useCase.execute({ window: '1h' });

    expect(result).toEqual({ remindedCount: 2 });
    expect(repos.sessionRepository.markReminder1hSent).toHaveBeenCalledWith(6);
    expect(repos.sessionRepository.markReminder1hSent).not.toHaveBeenCalledWith(5);
  });

  it('returns remindedCount 0 when nothing is due', async () => {
    const repos = buildRepos();
    repos.sessionRepository.listNeeding24hReminder.mockResolvedValue([]);
    const useCase = new SendUpcomingSessionRemindersUseCase(repos);

    const result = await useCase.execute({ window: '24h' });

    expect(result).toEqual({ remindedCount: 0 });
    expect(repos.webPushService.send).not.toHaveBeenCalled();
  });
});
