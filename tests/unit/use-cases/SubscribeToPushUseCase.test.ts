import { SubscribeToPushUseCase } from '../../../src/use-cases/push/SubscribeToPushUseCase';

function buildRepos() {
  return {
    pushSubscriptionRepository: {
      create: jest.fn().mockResolvedValue({
        id: 1,
        userId: 7,
        endpoint: 'https://push.example/device-a',
        p256dh: 'k',
        auth: 'a',
      }),
      deleteByEndpointForUser: jest.fn().mockResolvedValue(undefined),
    },
    webPushService: {
      send: jest.fn().mockResolvedValue(undefined),
    },
  };
}

const requester = { id: 7, firstname: 'Ivy' };
const validArgs = { requester, endpoint: 'https://push.example/device-a', keys: { p256dh: 'k', auth: 'a' } };

describe('SubscribeToPushUseCase', () => {
  it('rejects a call missing the endpoint or keys', async () => {
    const repos = buildRepos();
    const useCase = new SubscribeToPushUseCase(repos);

    await expect(useCase.execute({ requester, endpoint: '', keys: { p256dh: 'k', auth: 'a' } })).rejects.toThrow(
      'A valid push subscription',
    );
    await expect(useCase.execute({ requester, endpoint: 'https://push.example/x', keys: null })).rejects.toThrow(
      'A valid push subscription',
    );
    expect(repos.pushSubscriptionRepository.create).not.toHaveBeenCalled();
  });

  it('stores the subscription for the requesting user', async () => {
    const repos = buildRepos();
    const useCase = new SubscribeToPushUseCase(repos);

    await useCase.execute(validArgs);

    expect(repos.pushSubscriptionRepository.create).toHaveBeenCalledWith({
      userId: 7,
      endpoint: 'https://push.example/device-a',
      p256dh: 'k',
      auth: 'a',
    });
  });

  it('sends a "Notifications enabled" confirmation push by default (a genuine first-time opt-in)', async () => {
    const repos = buildRepos();
    const useCase = new SubscribeToPushUseCase(repos);

    await useCase.execute(validArgs);

    expect(repos.webPushService.send).toHaveBeenCalledWith(
      expect.objectContaining({ endpoint: 'https://push.example/device-a' }),
      expect.objectContaining({ title: 'Notifications enabled', body: expect.stringContaining('Ivy') }),
    );
  });

  it('skips the confirmation push when silent - a reconcile-on-load call, not a real opt-in', async () => {
    const repos = buildRepos();
    const useCase = new SubscribeToPushUseCase(repos);

    await useCase.execute({ ...validArgs, silent: true });

    expect(repos.webPushService.send).not.toHaveBeenCalled();
  });

  it('still stores/upserts the subscription when silent', async () => {
    const repos = buildRepos();
    const useCase = new SubscribeToPushUseCase(repos);

    const result = await useCase.execute({ ...validArgs, silent: true });

    expect(repos.pushSubscriptionRepository.create).toHaveBeenCalledTimes(1);
    expect(result).toEqual(expect.objectContaining({ endpoint: 'https://push.example/device-a' }));
  });

  it('prunes the subscription if the confirmation push reports it as already expired', async () => {
    const repos = buildRepos();
    repos.webPushService.send.mockRejectedValue(Object.assign(new Error('gone'), { expired: true }));
    const useCase = new SubscribeToPushUseCase(repos);

    await expect(useCase.execute(validArgs)).resolves.toBeDefined();

    expect(repos.pushSubscriptionRepository.deleteByEndpointForUser).toHaveBeenCalledWith(
      'https://push.example/device-a',
      7,
    );
  });

  it('does not fail the request if the confirmation push fails for a non-expiry reason', async () => {
    const repos = buildRepos();
    repos.webPushService.send.mockRejectedValue(new Error('push service unreachable'));
    const useCase = new SubscribeToPushUseCase(repos);

    await expect(useCase.execute(validArgs)).resolves.toBeDefined();
    expect(repos.pushSubscriptionRepository.deleteByEndpointForUser).not.toHaveBeenCalled();
  });
});
