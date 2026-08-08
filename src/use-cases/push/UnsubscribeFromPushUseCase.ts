class UnsubscribeFromPushUseCase {
  pushSubscriptionRepository: any;

  constructor({ pushSubscriptionRepository }) {
    this.pushSubscriptionRepository = pushSubscriptionRepository;
  }

  async execute({ requester, endpoint }) {
    if (!endpoint) {
      throw new Error('An endpoint is required to unsubscribe');
    }

    await this.pushSubscriptionRepository.deleteByEndpointForUser(endpoint, requester.id);
    return { message: 'Unsubscribed' };
  }
}

export { UnsubscribeFromPushUseCase };
