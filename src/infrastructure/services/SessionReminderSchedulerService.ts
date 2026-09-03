import cron from 'node-cron';

class SessionReminderSchedulerService {
  sendUpcomingSessionRemindersUseCase: any;

  constructor({ sendUpcomingSessionRemindersUseCase }) {
    this.sendUpcomingSessionRemindersUseCase = sendUpcomingSessionRemindersUseCase;
  }

  start() {
    const cronExpression = process.env.SESSION_REMINDER_JOB_CRON || '*/10 * * * *';

    cron.schedule(cronExpression, async () => {
      try {
        const day = await this.sendUpcomingSessionRemindersUseCase.execute({ window: '24h' });
        const hour = await this.sendUpcomingSessionRemindersUseCase.execute({ window: '1h' });
        if (day.remindedCount > 0 || hour.remindedCount > 0) {
          console.log(
            `[SessionReminderScheduler] Sent reminders for ${day.remindedCount} session(s) (24h) and ${hour.remindedCount} session(s) (1h)`
          );
        }
      } catch (err) {
        console.error('[SessionReminderScheduler] Failed to send session reminders:', err.message);
      }
    });

    console.log(`[SessionReminderScheduler] Started (cron: "${cronExpression}")`);
  }
}

export { SessionReminderSchedulerService };
