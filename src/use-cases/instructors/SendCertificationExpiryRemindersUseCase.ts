class SendCertificationExpiryRemindersUseCase {
  instructorRepository: any;
  userRepository: any;
  pushSubscriptionRepository: any;
  webPushService: any;
  emailService: any;

  constructor({ instructorRepository, userRepository, pushSubscriptionRepository, webPushService, emailService }) {
    this.instructorRepository = instructorRepository;
    this.userRepository = userRepository;
    this.pushSubscriptionRepository = pushSubscriptionRepository;
    this.webPushService = webPushService;
    this.emailService = emailService;
  }

  async execute({ thresholdDays = 30 }: { thresholdDays?: number } = {}) {
    const expiring = await this.instructorRepository.listExpiringCertifications(thresholdDays);

    let remindedCount = 0;
    for (const item of expiring) {
      await this.remindOne(item).catch((err: any) => {
        console.error(
          `[CertificationExpiryReminders] Failed to remind for instructor ${item.instructorId} / training ${item.trainingId}:`,
          err.message,
        );
      });
      remindedCount += 1;
    }

    return { remindedCount };
  }

  async remindOne(item: {
    instructorId: number;
    instructorUserId: number;
    instructorFirstname: string;
    trainingId: number;
    trainingName: string;
    certificateExpiresAt: Date;
  }) {
    const expiresAt = item.certificateExpiresAt;
    const isExpired = expiresAt.getTime() <= Date.now();

    await Promise.all([
      this.notifyInstructor(item, isExpired),
      this.notifyManagers(item, isExpired),
    ]);

    await this.instructorRepository.markExpiryReminderSent(item.instructorId, item.trainingId);
  }

  async notifyInstructor(item, isExpired: boolean) {
    const title = isExpired ? 'Certification expired' : 'Certification expiring soon';
    const body = isExpired
      ? `Your ${item.trainingName} certification has expired.`
      : `Your ${item.trainingName} certification expires soon.`;
    const url = '/instructors/me';

    const subscriptions = await this.pushSubscriptionRepository.listByUserId(item.instructorUserId);
    await Promise.all(
      subscriptions.map((subscription) =>
        this.webPushService.send(subscription, { title, body, url }).catch((err: any) => {
          if (err.expired) {
            return this.pushSubscriptionRepository.deleteByEndpointForUser(subscription.endpoint, item.instructorUserId);
          }
          console.error('[CertificationExpiryReminders] Failed to send push to instructor:', err.message);
        }),
      ),
    );

    const instructorUser = await this.userRepository.findById(item.instructorUserId);
    if (instructorUser?.email) {
      await this.emailService
        .sendCertificationExpiringInstructorEmail(instructorUser.email, item.instructorFirstname, {
          trainingName: item.trainingName,
          expiresAt: item.certificateExpiresAt,
          isExpired,
        })
        .catch((err: any) => {
          console.error('[CertificationExpiryReminders] Failed to email instructor:', err.message);
        });
    }
  }

  async notifyManagers(item, isExpired: boolean) {
    const managers = await this.userRepository.listApprovedManagers();
    if (!managers || managers.length === 0) return;

    const title = isExpired ? 'Instructor certification expired' : 'Instructor certification expiring soon';
    const body = isExpired
      ? `${item.instructorFirstname}'s ${item.trainingName} certification has expired.`
      : `${item.instructorFirstname}'s ${item.trainingName} certification expires soon.`;
    const url = '/instructors';

    await Promise.all(
      managers.map(async (manager) => {
        const subscriptions = await this.pushSubscriptionRepository.listByUserId(manager.id);
        await Promise.all(
          subscriptions.map((subscription) =>
            this.webPushService.send(subscription, { title, body, url }).catch((err: any) => {
              if (err.expired) {
                return this.pushSubscriptionRepository.deleteByEndpointForUser(subscription.endpoint, manager.id);
              }
              console.error('[CertificationExpiryReminders] Failed to send push to manager:', err.message);
            }),
          ),
        );
      }),
    );

    await this.emailService
      .sendCertificationExpiringManagerEmail(
        managers.map((manager) => manager.email),
        { instructorName: item.instructorFirstname, trainingName: item.trainingName, expiresAt: item.certificateExpiresAt, isExpired },
      )
      .catch((err: any) => {
        console.error('[CertificationExpiryReminders] Failed to email managers:', err.message);
      });
  }
}

export { SendCertificationExpiryRemindersUseCase };
