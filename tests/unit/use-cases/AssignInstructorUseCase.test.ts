import { AssignInstructorUseCase } from '../../../src/use-cases/sessions/AssignInstructorUseCase';

function buildRequester(overrides: Record<string, any> = {}) {
  return {
    isManager: () => false,
    isSuperAdmin: () => false,
    ...overrides,
  };
}

function buildRepos() {
  return {
    sessionRepository: {
      findById: jest.fn().mockResolvedValue({ id: 5, trainingId: 3, startDate: '2026-01-01T10:00:00.000Z' }),
      assignInstructor: jest.fn().mockResolvedValue({ id: 5, instructorId: 9 }),
    },
    instructorRepository: {
      findById: jest.fn().mockResolvedValue({
        id: 9,
        status: 'approved',
        userId: 42,
        email: 'instructor@example.com',
        firstname: 'Ivy',
      }),
      isQualifiedForTraining: jest.fn().mockResolvedValue(true),
    },
    trainingRepository: {
      findById: jest.fn().mockResolvedValue({ id: 3, name: 'RHCSA' }),
    },
    emailService: {
      sendInstructorAssignedEmail: jest.fn().mockResolvedValue(undefined),
    },
    webPushService: {
      send: jest.fn().mockResolvedValue(undefined),
    },
    pushSubscriptionRepository: {
      listByUserId: jest.fn().mockResolvedValue([{ endpoint: 'https://push.example/abc', p256dh: 'k', auth: 'a' }]),
      deleteByEndpointForUser: jest.fn().mockResolvedValue(undefined),
    },
  };
}

describe('AssignInstructorUseCase', () => {
  it('rejects a requester who is neither Manager nor SuperAdmin', async () => {
    const repos = buildRepos();
    const useCase = new AssignInstructorUseCase(repos);

    await expect(
      useCase.execute({ requester: buildRequester(), sessionId: 5, instructorId: 9 })
    ).rejects.toThrow('Only a Manager');
    expect(repos.sessionRepository.findById).not.toHaveBeenCalled();
  });

  it('allows a SuperAdmin even though they are not a Manager', async () => {
    const repos = buildRepos();
    const useCase = new AssignInstructorUseCase(repos);

    await expect(
      useCase.execute({ requester: buildRequester({ isSuperAdmin: () => true }), sessionId: 5, instructorId: 9 })
    ).resolves.toBeDefined();
    expect(repos.sessionRepository.assignInstructor).toHaveBeenCalledWith(5, 9);
    expect(repos.instructorRepository.isQualifiedForTraining).toHaveBeenCalledWith(9, 3);
  });

  it('rejects an instructor who is not approved (still pending or rejected)', async () => {
    const repos = buildRepos();
    repos.instructorRepository.findById.mockResolvedValue({ id: 9, status: 'pending' });
    const useCase = new AssignInstructorUseCase(repos);

    await expect(
      useCase.execute({ requester: buildRequester({ isManager: () => true }), sessionId: 5, instructorId: 9 })
    ).rejects.toThrow('not an active, approved instructor');
    expect(repos.sessionRepository.assignInstructor).not.toHaveBeenCalled();
  });

  it('rejects an instructor who is not qualified for this session\'s training', async () => {
    const repos = buildRepos();
    repos.instructorRepository.isQualifiedForTraining.mockResolvedValue(false);
    const useCase = new AssignInstructorUseCase(repos);

    await expect(
      useCase.execute({ requester: buildRequester({ isManager: () => true }), sessionId: 5, instructorId: 9 })
    ).rejects.toThrow('not marked as qualified');
    expect(repos.sessionRepository.assignInstructor).not.toHaveBeenCalled();
  });

  describe('notifying the assigned instructor', () => {
    it('emails the instructor with the training name and a link to the session', async () => {
      const repos = buildRepos();
      const useCase = new AssignInstructorUseCase(repos);

      await useCase.execute({ requester: buildRequester({ isManager: () => true }), sessionId: 5, instructorId: 9 });

      expect(repos.emailService.sendInstructorAssignedEmail).toHaveBeenCalledWith(
        'instructor@example.com',
        'Ivy',
        expect.objectContaining({ trainingName: 'RHCSA', startDate: '2026-01-01T10:00:00.000Z' }),
      );
    });

    it('sends a push notification to every device the instructor is subscribed on', async () => {
      const repos = buildRepos();
      repos.pushSubscriptionRepository.listByUserId.mockResolvedValue([
        { endpoint: 'https://push.example/device-a', p256dh: 'k1', auth: 'a1' },
        { endpoint: 'https://push.example/device-b', p256dh: 'k2', auth: 'a2' },
      ]);
      const useCase = new AssignInstructorUseCase(repos);

      await useCase.execute({ requester: buildRequester({ isManager: () => true }), sessionId: 5, instructorId: 9 });

      expect(repos.pushSubscriptionRepository.listByUserId).toHaveBeenCalledWith(42);
      expect(repos.webPushService.send).toHaveBeenCalledTimes(2);
      expect(repos.webPushService.send).toHaveBeenCalledWith(
        expect.objectContaining({ endpoint: 'https://push.example/device-a' }),
        expect.objectContaining({ title: expect.any(String), body: expect.stringContaining('RHCSA'), url: '/sessions/5' }),
      );
    });

    it('cleans up a push subscription the push service reports as expired, without throwing', async () => {
      const repos = buildRepos();
      repos.webPushService.send.mockRejectedValue(Object.assign(new Error('gone'), { expired: true }));
      const useCase = new AssignInstructorUseCase(repos);

      await expect(
        useCase.execute({ requester: buildRequester({ isManager: () => true }), sessionId: 5, instructorId: 9 })
      ).resolves.toBeDefined();
      expect(repos.pushSubscriptionRepository.deleteByEndpointForUser).toHaveBeenCalledWith(
        'https://push.example/abc',
        42,
      );
    });

    it('still returns the assignment even if every notification channel fails', async () => {
      const repos = buildRepos();
      repos.trainingRepository.findById.mockRejectedValue(new Error('db is down'));
      const useCase = new AssignInstructorUseCase(repos);

      const result = await useCase.execute({
        requester: buildRequester({ isManager: () => true }),
        sessionId: 5,
        instructorId: 9,
      });
      expect(result).toEqual({ id: 5, instructorId: 9 });
    });
  });
});
