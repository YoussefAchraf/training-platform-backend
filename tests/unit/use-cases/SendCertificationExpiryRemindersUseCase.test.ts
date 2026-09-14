import { SendCertificationExpiryRemindersUseCase } from '../../../src/use-cases/instructors/SendCertificationExpiryRemindersUseCase';

const expiringSoon = {
  instructorId: 9,
  instructorUserId: 42,
  instructorFirstname: 'Ivy',
  trainingId: 3,
  trainingName: 'RHCSA',
  certificateExpiresAt: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
};

function buildRepos() {
  return {
    instructorRepository: {
      listExpiringCertifications: jest.fn().mockResolvedValue([expiringSoon]),
      markExpiryReminderSent: jest.fn().mockResolvedValue(undefined),
    },
    userRepository: {
      findById: jest.fn().mockResolvedValue({ id: 42, email: 'ivy@example.com' }),
      listApprovedManagers: jest.fn().mockResolvedValue([{ id: 1, email: 'manager@example.com' }]),
    },
    pushSubscriptionRepository: {
      listByUserId: jest.fn().mockResolvedValue([{ endpoint: 'https://push.example/abc', p256dh: 'k', auth: 'a' }]),
      deleteByEndpointForUser: jest.fn().mockResolvedValue(undefined),
    },
    webPushService: {
      send: jest.fn().mockResolvedValue(undefined),
    },
    emailService: {
      sendCertificationExpiringInstructorEmail: jest.fn().mockResolvedValue(undefined),
      sendCertificationExpiringManagerEmail: jest.fn().mockResolvedValue(undefined),
    },
  };
}

describe('SendCertificationExpiryRemindersUseCase', () => {
  it('lists certifications expiring within the given threshold', async () => {
    const repos = buildRepos();
    const useCase = new SendCertificationExpiryRemindersUseCase(repos);

    const result = await useCase.execute({ thresholdDays: 30 });

    expect(repos.instructorRepository.listExpiringCertifications).toHaveBeenCalledWith(30);
    expect(result).toEqual({ remindedCount: 1 });
  });

  it('defaults the threshold to 30 days', async () => {
    const repos = buildRepos();
    const useCase = new SendCertificationExpiryRemindersUseCase(repos);

    await useCase.execute();

    expect(repos.instructorRepository.listExpiringCertifications).toHaveBeenCalledWith(30);
  });

  it('sends a push and an email to the instructor', async () => {
    const repos = buildRepos();
    const useCase = new SendCertificationExpiryRemindersUseCase(repos);

    await useCase.execute();

    expect(repos.pushSubscriptionRepository.listByUserId).toHaveBeenCalledWith(42);
    expect(repos.webPushService.send).toHaveBeenCalledWith(
      expect.objectContaining({ endpoint: 'https://push.example/abc' }),
      expect.objectContaining({ body: expect.stringContaining('RHCSA'), url: '/instructors/me' }),
    );
    expect(repos.emailService.sendCertificationExpiringInstructorEmail).toHaveBeenCalledWith(
      'ivy@example.com',
      'Ivy',
      expect.objectContaining({ trainingName: 'RHCSA', isExpired: false }),
    );
  });

  it('sends a push and an email to every approved manager', async () => {
    const repos = buildRepos();
    repos.userRepository.listApprovedManagers.mockResolvedValue([
      { id: 1, email: 'manager-a@example.com' },
      { id: 2, email: 'manager-b@example.com' },
    ]);
    const useCase = new SendCertificationExpiryRemindersUseCase(repos);

    await useCase.execute();

    expect(repos.pushSubscriptionRepository.listByUserId).toHaveBeenCalledWith(1);
    expect(repos.pushSubscriptionRepository.listByUserId).toHaveBeenCalledWith(2);
    expect(repos.emailService.sendCertificationExpiringManagerEmail).toHaveBeenCalledWith(
      ['manager-a@example.com', 'manager-b@example.com'],
      expect.objectContaining({ instructorName: 'Ivy', trainingName: 'RHCSA' }),
    );
  });

  it('marks isExpired true once the certificate date has already passed', async () => {
    const repos = buildRepos();
    repos.instructorRepository.listExpiringCertifications.mockResolvedValue([
      { ...expiringSoon, certificateExpiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    ]);
    const useCase = new SendCertificationExpiryRemindersUseCase(repos);

    await useCase.execute();

    expect(repos.emailService.sendCertificationExpiringInstructorEmail).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      expect.objectContaining({ isExpired: true }),
    );
  });

  it('marks the reminder sent after notifying', async () => {
    const repos = buildRepos();
    const useCase = new SendCertificationExpiryRemindersUseCase(repos);

    await useCase.execute();

    expect(repos.instructorRepository.markExpiryReminderSent).toHaveBeenCalledWith(9, 3);
  });

  it('cleans up an expired push subscription without throwing', async () => {
    const repos = buildRepos();
    repos.webPushService.send.mockRejectedValue(Object.assign(new Error('gone'), { expired: true }));
    const useCase = new SendCertificationExpiryRemindersUseCase(repos);

    await expect(useCase.execute()).resolves.toEqual({ remindedCount: 1 });
    expect(repos.pushSubscriptionRepository.deleteByEndpointForUser).toHaveBeenCalledWith('https://push.example/abc', 42);
  });

  it('does not let one failure block the rest, and still counts every candidate processed', async () => {
    const repos = buildRepos();
    repos.instructorRepository.listExpiringCertifications.mockResolvedValue([
      expiringSoon,
      { ...expiringSoon, instructorId: 10, instructorUserId: 43, trainingId: 4, trainingName: 'RHCE' },
    ]);
    repos.userRepository.findById.mockImplementation((userId: number) =>
      userId === 42 ? Promise.reject(new Error('db is down')) : Promise.resolve({ id: userId, email: 'other@example.com' }),
    );
    const useCase = new SendCertificationExpiryRemindersUseCase(repos);

    const result = await useCase.execute();

    expect(result).toEqual({ remindedCount: 2 });
  });

  it('returns remindedCount 0 when nothing is expiring', async () => {
    const repos = buildRepos();
    repos.instructorRepository.listExpiringCertifications.mockResolvedValue([]);
    const useCase = new SendCertificationExpiryRemindersUseCase(repos);

    const result = await useCase.execute();

    expect(result).toEqual({ remindedCount: 0 });
    expect(repos.webPushService.send).not.toHaveBeenCalled();
  });
});
