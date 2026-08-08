class SubscribeToPushUseCase {
  pushSubscriptionRepository: any;
  webPushService: any;

  constructor({ pushSubscriptionRepository, webPushService }) {
    this.pushSubscriptionRepository = pushSubscriptionRepository;
    this.webPushService = webPushService;
  }

  async execute({ requester, endpoint, keys }) {
    if (!endpoint || !keys || !keys.p256dh || !keys.auth) {
      throw new Error('A valid push subscription (endpoint and keys) is required');
    }

    const subscription = await this.pushSubscriptionRepository.create({
      userId: requester.id,
      endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth,
    });

    
    
    try {
      await this.webPushService.send(subscription, {
        title: 'Notifications enabled',
        body: `You'll now get push notifications on this device, ${requester.firstname}.`,
        url: '/account',
      });
    } catch (err: any) {
      if (err.expired) {
        await this.pushSubscriptionRepository.deleteByEndpointForUser(endpoint, requester.id);
      }
      
      
    }

    return subscription;
  }
}

export { SubscribeToPushUseCase };
