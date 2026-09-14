import cron from 'node-cron';

class CertificationExpirySchedulerService {
  sendCertificationExpiryRemindersUseCase: any;

  constructor({ sendCertificationExpiryRemindersUseCase }) {
    this.sendCertificationExpiryRemindersUseCase = sendCertificationExpiryRemindersUseCase;
  }

  start() {
    const cronExpression = process.env.CERT_EXPIRY_REMINDER_JOB_CRON || '0 8 * * *';
    const thresholdDays = Number(process.env.CERT_EXPIRY_REMINDER_DAYS) || 30;

    cron.schedule(cronExpression, async () => {
      try {
        const { remindedCount } = await this.sendCertificationExpiryRemindersUseCase.execute({ thresholdDays });
        if (remindedCount > 0) {
          console.log(`[CertificationExpiryScheduler] Sent reminders for ${remindedCount} certification(s)`);
        }
      } catch (err) {
        console.error('[CertificationExpiryScheduler] Failed to send certification expiry reminders:', err.message);
      }
    });

    console.log(`[CertificationExpiryScheduler] Started (cron: "${cronExpression}", threshold: ${thresholdDays} days)`);
  }
}

export { CertificationExpirySchedulerService };
