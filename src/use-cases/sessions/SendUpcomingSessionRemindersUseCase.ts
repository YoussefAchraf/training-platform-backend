




class SendUpcomingSessionRemindersUseCase {
  sessionRepository: any;
  trainingRepository: any;
  instructorRepository: any;
  pushSubscriptionRepository: any;
  webPushService: any;

  constructor({ sessionRepository, trainingRepository, instructorRepository, pushSubscriptionRepository, webPushService }) {
    this.sessionRepository = sessionRepository;
    this.trainingRepository = trainingRepository;
    this.instructorRepository = instructorRepository;
    this.pushSubscriptionRepository = pushSubscriptionRepository;
    this.webPushService = webPushService;
  }

  async execute({ window }: { window: '24h' | '1h' }) {
    const sessions =
      window === '24h'
        ? await this.sessionRepository.listNeeding24hReminder()
        : await this.sessionRepository.listNeeding1hReminder();

    for (const session of sessions) {
      await this.remindOne(session, window).catch((err: any) => {
        console.error(`[SessionReminders] Failed to remind for session ${session.id} (${window}):`, err.message);
      });
    }

    return { remindedCount: sessions.length };
  }

  async remindOne(session: any, window: '24h' | '1h') {
    const training = await this.trainingRepository.findById(session.trainingId);
    const trainingName = training ? training.name : 'a training session';
    const sessionPath = `/sessions/${session.id}`;

    const recipientUserIds = new Set<number>();
    if (session.instructorId) {
      const instructor = await this.instructorRepository.findById(session.instructorId);
      if (instructor) recipientUserIds.add(instructor.userId);
    }
    if (session.createdBy) recipientUserIds.add(session.createdBy);

    const payload =
      window === '24h'
        ? {
            title: 'Upcoming session',
            body: `${trainingName} starts within a day.`,
            url: sessionPath,
          }
        : {
            title: 'Session starting soon',
            body: `${trainingName} starts within the hour.`,
            url: sessionPath,
          };

    await Promise.all([...recipientUserIds].map((userId) => this.notifyUser(userId, payload)));

    if (window === '24h') {
      await this.sessionRepository.markReminder24hSent(session.id);
    } else {
      await this.sessionRepository.markReminder1hSent(session.id);
    }
  }

  async notifyUser(userId: number, payload: { title: string; body: string; url: string }) {
    const subscriptions = await this.pushSubscriptionRepository.listByUserId(userId);
    await Promise.all(
      subscriptions.map((subscription) =>
        this.webPushService.send(subscription, payload).catch((err: any) => {
          if (err.expired) {
            return this.pushSubscriptionRepository.deleteByEndpointForUser(subscription.endpoint, userId);
          }
          console.error('[SessionReminders] Failed to send push notification:', err.message);
        })
      )
    );
  }
}

export { SendUpcomingSessionRemindersUseCase };
